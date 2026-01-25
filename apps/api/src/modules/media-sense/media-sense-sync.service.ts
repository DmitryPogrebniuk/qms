import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/common/prisma/prisma.service';
import { MediaSenseClientService } from './media-sense-client.service';
import { MediaSenseLogger } from './media-sense-logger.service';
import { OpenSearchService } from '../opensearch/opensearch.service';
import { SyncStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * MediaSense Synchronization Service
 * 
 * Handles periodic synchronization of recording metadata from MediaSense to local DB + OpenSearch
 * 
 * Key features:
 * - Incremental sync using watermark (endTime-based)
 * - Overlap window for "maturing" records (15-30 min)
 * - Backfill support for initial setup
 * - Idempotent upsert operations
 * - Detailed logging with correlation IDs
 * - Rate limiting and error handling
 */

export interface SyncCheckpoint {
  lastSyncTime: string; // ISO timestamp
  lastSeenId?: string; // For tie-breaking
  backfillComplete: boolean;
  backfillProgress?: {
    currentDate: string;
    startDate: string;
    endDate: string;
  };
  [key: string]: unknown; // Index signature for Prisma JSON compatibility
}

export interface MediaSenseSessionData {
  sessionId: string;
  recordingId?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  direction?: string;
  ani?: string;
  dnis?: string;
  callerName?: string;
  calledName?: string;
  agentId?: string;
  agentName?: string;
  teamId?: string;
  teamName?: string;
  csq?: string;
  queueName?: string;
  skillGroup?: string;
  wrapUpReason?: string;
  wrapUpCode?: string;
  dispositionCode?: string;
  extension?: string;
  contactId?: string;
  callId?: string;
  transferCount?: number;
  holdTime?: number;
  talkTime?: number;
  ringTime?: number;
  queueTime?: number;
  participants?: Array<{
    type: string;
    id?: string;
    name?: string;
    phoneNumber?: string;
    deviceName?: string;
    joinTime?: string;
    leaveTime?: string;
  }>;
  media?: {
    hasAudio: boolean;
    codec?: string;
    sampleRate?: number;
    bitrate?: number;
    channels?: number;
    format?: string;
    size?: number;
    url?: string;
  };
  recorder?: {
    node?: string;
    cluster?: string;
  };
  tags?: Record<string, string>;
  customFields?: Record<string, any>;
  rawJson?: any;
}

export interface SyncResult {
  success: boolean;
  correlationId: string;
  duration: number;
  stats: {
    fetched: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  error?: string;
}

@Injectable()
export class MediaSenseSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('MediaSenseSyncService');
  private readonly SYNC_TYPE = 'mediasense_recordings';
  private readonly OVERLAP_WINDOW_MINUTES = 30; // Re-fetch last 30 min for maturing records
  private readonly DEFAULT_PAGE_SIZE = 100;
  private readonly MAX_PAGES_PER_SYNC = 50; // Limit pages per sync cycle
  private readonly DEFAULT_RETENTION_DAYS = 180; // 6 months
  
  private isSyncing = false;
  private syncEnabled = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mediaSenseClient: MediaSenseClientService,
    private readonly msLogger: MediaSenseLogger,
    private readonly openSearchService: OpenSearchService,
  ) {}

  async onModuleInit() {
    // Initialize sync state if not exists
    await this.ensureSyncState();
    
    // Check if MediaSense is configured
    const config = await this.getMediaSenseConfig();
    if (!config?.enabled) {
      this.logger.warn('MediaSense sync disabled - not configured');
      this.syncEnabled = false;
    }
  }

  onModuleDestroy() {
    this.syncEnabled = false;
  }

  /**
   * Scheduled sync every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledSync(): Promise<void> {
    if (!this.syncEnabled) {
      return;
    }

    try {
      await this.runIncrementalSync('scheduler');
    } catch (error) {
      this.logger.error('Scheduled sync failed:', error);
    }
  }

  /**
   * Run incremental sync (fetch new/updated records)
   */
  async runIncrementalSync(triggeredBy: string = 'manual'): Promise<SyncResult> {
    const correlationId = uuidv4().substring(0, 8);
    const startTime = Date.now();

    // Prevent concurrent syncs
    if (this.isSyncing) {
      this.msLogger.warn(`[${correlationId}] Sync already in progress, skipping`);
      return {
        success: false,
        correlationId,
        duration: 0,
        stats: { fetched: 0, created: 0, updated: 0, skipped: 0, errors: 0 },
        error: 'Sync already in progress',
      };
    }

    this.isSyncing = true;
    const stats = { fetched: 0, created: 0, updated: 0, skipped: 0, errors: 0 };

    try {
      this.msLogger.info(`[${correlationId}] Starting incremental sync`, { triggeredBy });
      
      // Get or create sync state
      const syncState = await this.getSyncState();
      const checkpoint = this.parseCheckpoint(syncState?.checkpoint);

      // Check if backfill is needed
      if (!checkpoint.backfillComplete) {
        return this.runBackfill(correlationId, triggeredBy, checkpoint);
      }

      // Update sync state to IN_PROGRESS
      await this.updateSyncStatus(SyncStatus.IN_PROGRESS, correlationId);

      // Configure MediaSense client
      await this.configureClient();

      // Calculate time range with overlap window
      const now = new Date();
      let fromTime: Date;
      
      if (checkpoint.lastSyncTime) {
        const lastSync = new Date(checkpoint.lastSyncTime);
        // Check if lastSyncTime is in the future (system clock issue or bad data)
        if (lastSync > now) {
          this.msLogger.warn(`[${correlationId}] lastSyncTime is in the future, resetting to 7 days ago`, {
            lastSyncTime: checkpoint.lastSyncTime,
            now: now.toISOString(),
          });
          fromTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else {
          fromTime = new Date(lastSync.getTime() - this.OVERLAP_WINDOW_MINUTES * 60 * 1000);
        }
      } else {
        fromTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default: last 24 hours
      }

      // Fetch sessions from MediaSense
      let page = 1;
      let hasMore = true;
      let lastProcessedTime = checkpoint.lastSyncTime;
      let lastProcessedId = checkpoint.lastSeenId;

      while (hasMore && page <= this.MAX_PAGES_PER_SYNC) {
        const sessions = await this.fetchSessions(fromTime, now, page, this.DEFAULT_PAGE_SIZE, correlationId);
        
        if (!sessions || sessions.length === 0) {
          hasMore = false;
          break;
        }

        stats.fetched += sessions.length;

        // Process each session
        for (const session of sessions) {
          try {
            const result = await this.processSession(session, correlationId);
            if (result === 'created') stats.created++;
            else if (result === 'updated') stats.updated++;
            else stats.skipped++;

            // Track watermark
            if (session.endTime && session.endTime > (lastProcessedTime || '')) {
              lastProcessedTime = session.endTime;
              lastProcessedId = session.sessionId;
            }
          } catch (err) {
            stats.errors++;
            this.msLogger.error(`[${correlationId}] Failed to process session ${session.sessionId}`, {
              error: (err as Error).message,
            });
          }
        }

        page++;
        hasMore = sessions.length === this.DEFAULT_PAGE_SIZE;

        // Rate limiting - small delay between pages
        await this.delay(100);
      }

      // Update checkpoint
      const newCheckpoint: SyncCheckpoint = {
        lastSyncTime: lastProcessedTime || now.toISOString(),
        lastSeenId: lastProcessedId,
        backfillComplete: true,
      };

      await this.updateSyncState(
        stats.errors > 0 ? SyncStatus.PARTIAL : SyncStatus.SUCCESS,
        newCheckpoint,
        stats,
        Date.now() - startTime,
        correlationId,
      );

      const duration = Date.now() - startTime;
      this.msLogger.info(`[${correlationId}] Incremental sync completed`, {
        duration,
        stats,
      });

      return {
        success: true,
        correlationId,
        duration,
        stats,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = (error as Error).message;

      this.msLogger.error(`[${correlationId}] Sync failed`, {
        error: errorMessage,
        duration,
        stats,
      });

      await this.updateSyncState(
        SyncStatus.FAILED,
        null,
        stats,
        duration,
        correlationId,
        errorMessage,
      );

      return {
        success: false,
        correlationId,
        duration,
        stats,
        error: errorMessage,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Run backfill for initial data load (fetch historical records in batches by date)
   */
  async runBackfill(
    correlationId: string,
    triggeredBy: string,
    existingCheckpoint: SyncCheckpoint,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const stats = { fetched: 0, created: 0, updated: 0, skipped: 0, errors: 0 };

    try {
      this.msLogger.info(`[${correlationId}] Starting backfill`, { triggeredBy });

      await this.updateSyncStatus(SyncStatus.IN_PROGRESS, correlationId);
      await this.configureClient();

      // Determine backfill date range
      const retentionDays = this.configService.get<number>('MEDIASENSE_RETENTION_DAYS') || this.DEFAULT_RETENTION_DAYS;
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - retentionDays * 24 * 60 * 60 * 1000);

      // Resume from checkpoint or start fresh
      let currentDate = existingCheckpoint.backfillProgress?.currentDate 
        ? new Date(existingCheckpoint.backfillProgress.currentDate)
        : new Date(startDate);

      const batchDays = 1; // Process one day at a time
      let processedBatches = 0;
      const maxBatchesPerRun = 7; // Limit to ~1 week per sync cycle

      while (currentDate < endDate && processedBatches < maxBatchesPerRun) {
        const batchEnd = new Date(Math.min(
          currentDate.getTime() + batchDays * 24 * 60 * 60 * 1000,
          endDate.getTime(),
        ));

        this.msLogger.info(`[${correlationId}] Backfill batch: ${currentDate.toISOString()} to ${batchEnd.toISOString()}`);

        // Fetch all pages for this date range
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const sessions = await this.fetchSessions(currentDate, batchEnd, page, this.DEFAULT_PAGE_SIZE, correlationId);
          
          if (!sessions || sessions.length === 0) {
            hasMore = false;
            break;
          }

          stats.fetched += sessions.length;

          for (const session of sessions) {
            try {
              const result = await this.processSession(session, correlationId);
              if (result === 'created') stats.created++;
              else if (result === 'updated') stats.updated++;
              else stats.skipped++;
            } catch (err) {
              stats.errors++;
            }
          }

          page++;
          hasMore = sessions.length === this.DEFAULT_PAGE_SIZE;
          await this.delay(100);
        }

        currentDate = batchEnd;
        processedBatches++;

        // Update checkpoint after each batch
        const progress: SyncCheckpoint = {
          lastSyncTime: currentDate.toISOString(),
          backfillComplete: currentDate >= endDate,
          backfillProgress: {
            currentDate: currentDate.toISOString(),
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        };

        await this.updateSyncState(
          SyncStatus.IN_PROGRESS,
          progress,
          stats,
          Date.now() - startTime,
          correlationId,
        );
      }

      // Check if backfill is complete
      const backfillComplete = currentDate >= endDate;
      
      const finalCheckpoint: SyncCheckpoint = {
        lastSyncTime: currentDate.toISOString(),
        backfillComplete,
        backfillProgress: backfillComplete ? undefined : {
          currentDate: currentDate.toISOString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      };

      await this.updateSyncState(
        backfillComplete ? SyncStatus.SUCCESS : SyncStatus.PARTIAL,
        finalCheckpoint,
        stats,
        Date.now() - startTime,
        correlationId,
      );

      const duration = Date.now() - startTime;
      this.msLogger.info(`[${correlationId}] Backfill ${backfillComplete ? 'completed' : 'progress saved'}`, {
        duration,
        stats,
        backfillComplete,
      });

      return {
        success: true,
        correlationId,
        duration,
        stats,
      };

    } catch (error) {
      const errorMessage = (error as Error).message;
      this.msLogger.error(`[${correlationId}] Backfill failed`, { error: errorMessage });

      await this.updateSyncState(
        SyncStatus.FAILED,
        existingCheckpoint,
        stats,
        Date.now() - startTime,
        correlationId,
        errorMessage,
      );

      return {
        success: false,
        correlationId,
        duration: Date.now() - startTime,
        stats,
        error: errorMessage,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Fetch sessions from MediaSense with pagination
   */
  private async fetchSessions(
    fromTime: Date,
    toTime: Date,
    page: number,
    pageSize: number,
    correlationId: string,
  ): Promise<MediaSenseSessionData[]> {
    this.msLogger.debug(`[${correlationId}] Fetching sessions page ${page}`, {
      fromTime: fromTime.toISOString(),
      toTime: toTime.toISOString(),
      pageSize,
    });

    try {
      // Note: Actual MediaSense API endpoints may vary by version
      // This is a template that should be adjusted for your MediaSense version
      const response = await this.mediaSenseClient.querySessions({
        startTime: fromTime.toISOString(),
        endTime: toTime.toISOString(),
        offset: (page - 1) * pageSize,
        limit: pageSize,
        // Add filters as needed: agentId, direction, etc.
      });

      if (!response.success || !response.data) {
        // Check if error is due to invalid session (4021)
        if (response.error?.includes('4021') || response.error?.includes('Invalid session')) {
          this.msLogger.error(`[${correlationId}] MediaSense returned Invalid session (4021) - JSESSIONIDSSO required`, {
            error: response.error,
            statusCode: response.statusCode,
            note: 'MediaSense 11.5 query endpoints require JSESSIONIDSSO cookie. Basic Auth may not work for query endpoints.',
            recommendation: 'Check MediaSense server configuration or use alternative method to obtain JSESSIONIDSSO',
          });
        } else {
          this.msLogger.warn(`[${correlationId}] No sessions returned from MediaSense`, {
            error: response.error,
            statusCode: response.statusCode,
            fromTime: fromTime.toISOString(),
            toTime: toTime.toISOString(),
            page,
          });
        }
        return [];
      }

      // Log raw response structure for debugging
      this.msLogger.debug(`[${correlationId}] MediaSense response structure`, {
        isArray: Array.isArray(response.data),
        hasSessions: Boolean((response.data as any)?.sessions),
        hasRecordings: Boolean((response.data as any)?.recordings),
        hasResults: Boolean((response.data as any)?.results),
        hasData: Boolean((response.data as any)?.data),
        hasItems: Boolean((response.data as any)?.items),
        keys: typeof response.data === 'object' && response.data !== null 
          ? Object.keys(response.data) 
          : 'not an object',
      });

      // Map MediaSense response to our normalized format
      return this.normalizeSessionData(response.data, correlationId);
    } catch (error) {
      this.msLogger.error(`[${correlationId}] Failed to fetch sessions`, {
        error: (error as Error).message,
        page,
      });
      throw error;
    }
  }

  /**
   * Normalize MediaSense API response to our internal format
   */
  private normalizeSessionData(rawData: any, correlationId: string): MediaSenseSessionData[] {
    // Handle different MediaSense response formats
    // According to Cisco documentation, MediaSense API returns:
    // { responseCode: 2000, responseMessage: "Success...", responseBody: { sessions: [...] } }
    let sessions: any[] = [];
    
    if (Array.isArray(rawData)) {
      // Direct array of sessions
      sessions = rawData;
    } else if (rawData && typeof rawData === 'object') {
      // MediaSense API response format: { responseBody: { sessions: [...] } }
      // Try responseBody first (standard MediaSense format)
      if (rawData.responseBody) {
        sessions = rawData.responseBody.sessions || 
                   rawData.responseBody.recordings || 
                   rawData.responseBody.results ||
                   (Array.isArray(rawData.responseBody) ? rawData.responseBody : []);
      }
      
      // Fallback to other possible structures
      if (!sessions || sessions.length === 0) {
        sessions = rawData.sessions || 
                   rawData.recordings || 
                   rawData.results || 
                   rawData.data?.sessions ||
                   rawData.data?.recordings ||
                   rawData.data?.results ||
                   rawData.items ||
                   (Array.isArray(rawData.data) ? rawData.data : []);
      }
    }
    
    if (!Array.isArray(sessions) || sessions.length === 0) {
      this.msLogger.warn(`[${correlationId}] No sessions found in response`, {
        rawDataType: typeof rawData,
        isArray: Array.isArray(rawData),
        hasResponseBody: Boolean(rawData?.responseBody),
        responseBodyKeys: rawData?.responseBody && typeof rawData.responseBody === 'object' 
          ? Object.keys(rawData.responseBody) 
          : 'N/A',
        keys: rawData && typeof rawData === 'object' ? Object.keys(rawData) : 'N/A',
        sample: rawData && typeof rawData === 'object' 
          ? JSON.stringify(rawData).substring(0, 500) 
          : String(rawData).substring(0, 500),
      });
      return [];
    }
    
    return sessions.map((raw: any) => {
      try {
        // MediaSense field mapping (adjust based on actual API response)
        return {
          sessionId: raw.sessionId || raw.id || raw.recordingId,
          recordingId: raw.recordingId || raw.mediaId,
          startTime: raw.startTime || raw.sessionStartTime,
          endTime: raw.endTime || raw.sessionEndTime,
          duration: raw.duration || raw.durationSeconds,
          direction: this.normalizeDirection(raw.direction || raw.callDirection),
          ani: raw.ani || raw.callerNumber || raw.fromNumber,
          dnis: raw.dnis || raw.calledNumber || raw.toNumber,
          callerName: raw.callerName || raw.fromName,
          calledName: raw.calledName || raw.toName,
          agentId: raw.agentId || raw.agent?.id || raw.ownerId,
          agentName: raw.agentName || raw.agent?.name || raw.ownerName,
          teamId: raw.teamId || raw.team?.id,
          teamName: raw.teamName || raw.team?.name,
          csq: raw.csq || raw.queue || raw.contactServiceQueue,
          queueName: raw.queueName || raw.queue?.name,
          skillGroup: raw.skillGroup || raw.skill,
          wrapUpReason: raw.wrapUpReason || raw.wrapUp?.reason,
          wrapUpCode: raw.wrapUpCode || raw.wrapUp?.code,
          dispositionCode: raw.dispositionCode || raw.disposition,
          extension: raw.extension || raw.agentExtension,
          contactId: raw.contactId || raw.contact?.id,
          callId: raw.callId || raw.call?.id,
          transferCount: raw.transferCount || raw.transfers || 0,
          holdTime: raw.holdTime || raw.holdDuration || 0,
          talkTime: raw.talkTime || raw.talkDuration,
          ringTime: raw.ringTime || raw.ringDuration,
          queueTime: raw.queueTime || raw.queueDuration,
          participants: this.normalizeParticipants(raw.participants || raw.parties),
          media: this.normalizeMedia(raw.media || raw.tracks || raw.recording),
          recorder: {
            node: raw.recorderNode || raw.recorder?.node,
            cluster: raw.recorderCluster || raw.recorder?.cluster,
          },
          tags: raw.tags || raw.labels || {},
          customFields: raw.customFields || raw.metadata || {},
          rawJson: raw,
        };
      } catch (err) {
        this.msLogger.warn(`[${correlationId}] Failed to normalize session`, {
          sessionId: raw?.sessionId || 'unknown',
          error: (err as Error).message,
        });
        return null;
      }
    }).filter(Boolean);
  }

  private normalizeDirection(direction?: string): string {
    if (!direction) return 'unknown';
    const d = direction.toLowerCase();
    if (d.includes('in') || d.includes('incom')) return 'inbound';
    if (d.includes('out')) return 'outbound';
    if (d.includes('internal')) return 'internal';
    return 'unknown';
  }

  private normalizeParticipants(participants?: any[]): MediaSenseSessionData['participants'] {
    if (!Array.isArray(participants)) return [];
    return participants.map(p => ({
      type: p.type || p.role || 'unknown',
      id: p.id || p.participantId,
      name: p.name || p.displayName,
      phoneNumber: p.phoneNumber || p.number || p.dn,
      deviceName: p.deviceName || p.device,
      joinTime: p.joinTime || p.startTime,
      leaveTime: p.leaveTime || p.endTime,
    }));
  }

  private normalizeMedia(media?: any): MediaSenseSessionData['media'] {
    if (!media) return { hasAudio: false };
    
    // Handle array of tracks
    const track = Array.isArray(media) ? media[0] : media;
    
    return {
      hasAudio: Boolean(track?.url || track?.mediaUrl || track?.audioUrl),
      codec: track?.codec || track?.audioCodec,
      sampleRate: track?.sampleRate || track?.audioSampleRate,
      bitrate: track?.bitrate || track?.audioBitrate,
      channels: track?.channels || 1,
      format: track?.format || track?.container || track?.fileType,
      size: track?.size || track?.fileSize,
      url: track?.url || track?.mediaUrl || track?.audioUrl || track?.downloadUrl,
    };
  }

  /**
   * Process a single session - upsert to DB and index to OpenSearch
   */
  private async processSession(
    session: MediaSenseSessionData,
    correlationId: string,
  ): Promise<'created' | 'updated' | 'skipped'> {
    if (!session.sessionId) {
      this.msLogger.warn(`[${correlationId}] Skipping session without ID`);
      return 'skipped';
    }

    // Check if exists
    const existing = await this.prisma.recording.findUnique({
      where: { mediasenseSessionId: session.sessionId },
      select: { id: true, updatedAt: true, endTime: true },
    });

    // Prepare recording data
    const recordingData = {
      mediasenseSessionId: session.sessionId,
      mediasenseRecordingId: session.recordingId,
      agentId: session.agentId ? await this.resolveAgentId(session.agentId) : null,
      teamCode: session.teamId || null,
      agentName: session.agentName,
      teamName: session.teamName,
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : null,
      durationSeconds: session.duration || 0,
      contactId: session.contactId,
      callId: session.callId,
      direction: session.direction || 'unknown',
      ani: session.ani,
      dnis: session.dnis,
      callerName: session.callerName,
      calledName: session.calledName,
      extension: session.extension,
      csq: session.csq,
      queueName: session.queueName,
      skillGroup: session.skillGroup,
      wrapUpReason: session.wrapUpReason,
      wrapUpCode: session.wrapUpCode,
      dispositionCode: session.dispositionCode,
      transferCount: session.transferCount || 0,
      holdTimeSeconds: session.holdTime || 0,
      talkTimeSeconds: session.talkTime || 0,
      ringTimeSeconds: session.ringTime || 0,
      queueTimeSeconds: session.queueTime || 0,
      hasAudio: session.media?.hasAudio || false,
      audioCodec: session.media?.codec,
      audioSampleRate: session.media?.sampleRate,
      audioBitrate: session.media?.bitrate,
      audioChannels: session.media?.channels || 1,
      audioFormat: session.media?.format,
      audioSizeBytes: session.media?.size ? BigInt(session.media.size) : null,
      audioUrl: session.media?.url,
      recorderNode: session.recorder?.node,
      recorderCluster: session.recorder?.cluster,
      rawMetadata: session.rawJson,
      customFields: session.customFields,
      syncedAt: new Date(),
      searchVector: this.buildSearchVector(session),
    };

    let result: 'created' | 'updated';
    let recordingId: string;

    if (existing) {
      // Update only if data changed (check endTime as indicator)
      const shouldUpdate = !existing.endTime || 
        (session.endTime && new Date(session.endTime) > existing.endTime);

      if (!shouldUpdate) {
        return 'skipped';
      }

      const updated = await this.prisma.recording.update({
        where: { id: existing.id },
        data: recordingData,
      });
      recordingId = updated.id;
      result = 'updated';
    } else {
      const created = await this.prisma.recording.create({
        data: recordingData,
      });
      recordingId = created.id;
      result = 'created';
    }

    // Process participants
    if (session.participants && session.participants.length > 0) {
      await this.processParticipants(recordingId, session.participants);
    }

    // Process tags
    if (session.tags && Object.keys(session.tags).length > 0) {
      await this.processTags(recordingId, session.tags);
    }

    // Index to OpenSearch (async, don't block)
    this.indexToOpenSearch(recordingId, session, recordingData).catch(err => {
      this.msLogger.error(`[${correlationId}] OpenSearch indexing failed for ${recordingId}`, {
        error: err.message,
      });
    });

    return result;
  }

  private buildSearchVector(session: MediaSenseSessionData): string {
    // Build full-text search string
    const parts = [
      session.ani,
      session.dnis,
      session.agentName,
      session.agentId,
      session.teamName,
      session.csq,
      session.queueName,
      session.callerName,
      session.calledName,
      session.wrapUpReason,
      session.callId,
      session.sessionId,
    ].filter(Boolean);

    return parts.join(' ');
  }

  private async resolveAgentId(agentIdOrName: string): Promise<string | null> {
    // Try to find agent in our DB
    const agent = await this.prisma.agent.findFirst({
      where: {
        OR: [
          { agentId: agentIdOrName },
          { fullName: { contains: agentIdOrName, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    return agent?.id || null;
  }

  private async processParticipants(
    recordingId: string,
    participants: NonNullable<MediaSenseSessionData['participants']>,
  ): Promise<void> {
    // Delete existing participants and recreate
    await this.prisma.recordingParticipant.deleteMany({
      where: { recordingId },
    });

    for (const p of participants) {
      await this.prisma.recordingParticipant.create({
        data: {
          recordingId,
          participantType: p.type,
          participantId: p.id,
          participantName: p.name,
          phoneNumber: p.phoneNumber,
          deviceName: p.deviceName,
          joinTime: p.joinTime ? new Date(p.joinTime) : null,
          leaveTime: p.leaveTime ? new Date(p.leaveTime) : null,
        },
      });
    }
  }

  private async processTags(recordingId: string, tags: Record<string, string>): Promise<void> {
    for (const [tagName, tagValue] of Object.entries(tags)) {
      await this.prisma.recordingTag.upsert({
        where: {
          recordingId_tagName: { recordingId, tagName },
        },
        create: {
          recordingId,
          tagName,
          tagValue,
          tagSource: 'mediasense',
        },
        update: {
          tagValue,
        },
      });
    }
  }

  private async indexToOpenSearch(
    recordingId: string,
    session: MediaSenseSessionData,
    dbData: any,
  ): Promise<void> {
    try {
      await this.openSearchService.indexRecording({
        id: recordingId,
        mediasenseSessionId: session.sessionId,
        agentId: dbData.agentId,
        agentName: session.agentName,
        teamCode: dbData.teamCode,
        teamName: session.teamName,
        startTime: dbData.startTime,
        endTime: dbData.endTime,
        durationSeconds: dbData.durationSeconds,
        direction: dbData.direction,
        ani: session.ani,
        dnis: session.dnis,
        callerName: session.callerName,
        calledName: session.calledName,
        csq: session.csq,
        queueName: session.queueName,
        skillGroup: session.skillGroup,
        wrapUpReason: session.wrapUpReason,
        callId: session.callId,
        hasAudio: dbData.hasAudio,
        tags: session.tags ? Object.keys(session.tags) : [],
        searchText: dbData.searchVector,
      });
    } catch (error) {
      // Non-fatal, log and continue
      this.msLogger.warn(`Failed to index recording ${recordingId} to OpenSearch`, {
        error: (error as Error).message,
      });
    }
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private async getMediaSenseConfig(): Promise<{
    enabled: boolean;
    apiUrl?: string;
    apiKey?: string;
    apiSecret?: string;
    allowSelfSigned?: boolean;
  }> {
    try {
      // Get from IntegrationSetting in DB
      const setting = await this.prisma.integrationSetting.findUnique({
        where: { integrationType: 'mediasense' },
      });
      if (!setting || !setting.isEnabled || !setting.settings) {
        return { enabled: false };
      }
      const { apiUrl, apiKey, apiSecret, allowSelfSigned } = setting.settings as any;
      return {
        enabled: Boolean(apiUrl && apiKey && apiSecret),
        apiUrl,
        apiKey,
        apiSecret,
        allowSelfSigned,
      };
    } catch {
      return { enabled: false };
    }
  }

  private async configureClient(): Promise<void> {
    const config = await this.getMediaSenseConfig();
    if (!config?.enabled) {
      throw new Error('MediaSense not configured');
    }
    this.mediaSenseClient.configure({
      baseUrl: config.apiUrl,
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      allowSelfSigned: config.allowSelfSigned,
    });
  }

  private async ensureSyncState(): Promise<void> {
    const existing = await this.prisma.syncState.findUnique({
      where: { syncType: this.SYNC_TYPE },
    });

    if (!existing) {
      await this.prisma.syncState.create({
        data: {
          syncType: this.SYNC_TYPE,
          status: SyncStatus.IDLE,
          checkpoint: { backfillComplete: false },
        },
      });
    }
  }

  private async getSyncState() {
    return this.prisma.syncState.findUnique({
      where: { syncType: this.SYNC_TYPE },
    });
  }

  private parseCheckpoint(checkpoint: any): SyncCheckpoint {
    if (!checkpoint) {
      return { lastSyncTime: '', backfillComplete: false };
    }
    return checkpoint as SyncCheckpoint;
  }

  private async updateSyncStatus(status: SyncStatus, correlationId: string): Promise<void> {
    await this.prisma.syncState.update({
      where: { syncType: this.SYNC_TYPE },
      data: { status },
    });
  }

  private async updateSyncState(
    status: SyncStatus,
    checkpoint: SyncCheckpoint | null,
    stats: { fetched: number; created: number; updated: number; skipped: number; errors: number },
    durationMs: number,
    correlationId: string,
    errorMessage?: string,
  ): Promise<void> {
    const now = new Date();

    await this.prisma.syncState.update({
      where: { syncType: this.SYNC_TYPE },
      data: {
        status,
        checkpoint: checkpoint ? JSON.parse(JSON.stringify(checkpoint)) : undefined,
        watermarkTime: checkpoint?.lastSyncTime ? new Date(checkpoint.lastSyncTime) : undefined,
        lastSyncedAt: now,
        nextSyncAt: new Date(now.getTime() + 5 * 60 * 1000), // +5 min
        totalFetched: { increment: stats.fetched },
        totalCreated: { increment: stats.created },
        totalUpdated: { increment: stats.updated },
        totalErrors: { increment: stats.errors },
        lastBatchSize: stats.fetched,
        lastDurationMs: durationMs,
        errorMessage: errorMessage || null,
      },
    });

    // Record in history
    await this.prisma.syncHistory.create({
      data: {
        syncStateId: (await this.getSyncState())!.id,
        status,
        fetched: stats.fetched,
        created: stats.created,
        updated: stats.updated,
        skipped: stats.skipped,
        errors: stats.errors,
        durationMs,
        completedAt: now,
        correlationId,
        errorMessage,
      },
    });
  }

  /**
   * Manual trigger for admin
   */
  async triggerSyncNow(): Promise<SyncResult> {
    return this.runIncrementalSync('manual');
  }

  /**
   * Reset sync state (for testing/recovery)
   */
  async resetSyncState(): Promise<void> {
    await this.prisma.syncState.update({
      where: { syncType: this.SYNC_TYPE },
      data: {
        status: SyncStatus.IDLE,
        checkpoint: JSON.parse(JSON.stringify({ backfillComplete: false })),
        watermark: null,
        watermarkTime: null,
        totalFetched: 0,
        totalCreated: 0,
        totalUpdated: 0,
        totalErrors: 0,
        errorMessage: null,
      },
    });
  }

  /**
   * Get sync status for admin UI
   */
  async getSyncStatus(): Promise<any> {
    const state = await this.prisma.syncState.findUnique({
      where: { syncType: this.SYNC_TYPE },
      include: {
        syncHistory: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    return {
      ...state,
      isSyncing: this.isSyncing,
      syncEnabled: this.syncEnabled,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
