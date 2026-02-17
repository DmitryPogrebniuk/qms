import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { MediaSenseSyncService } from '../media-sense/media-sense-sync.service';
import { OpenSearchService } from '../opensearch/opensearch.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class RecordingsService {
  private readonly logger = new Logger('RecordingsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: MediaSenseSyncService,
    private readonly openSearchService: OpenSearchService,
  ) {}

  /**
   * Get recording details with all metadata
   */
  async getRecordingDetails(recordingId: string, userId: string, userRole: string) {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
      include: {
        agent: {
          select: { id: true, agentId: true, fullName: true, email: true },
        },
        team: {
          select: { id: true, teamCode: true, displayName: true },
        },
        participants: true,
        tags: true,
        notes: {
          orderBy: { timestamp: 'asc' },
        },
        evaluation: {
          include: {
            scorecardTemplate: { select: { id: true, name: true } },
            scorecard: { select: { id: true, name: true } },
            bookmarks: true,
            answers: { include: { question: true } },
          },
        },
      },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    // Check access
    await this._enforceAccess(recording, userId, userRole);

    return {
      ...recording,
      agentName: recording.agentName || recording.agent?.fullName,
      teamName: recording.teamName || recording.team?.displayName,
      // Denormalized fields
      formattedDuration: this.formatDuration(recording.durationSeconds),
      formattedStartTime: recording.startTime.toISOString(),
      formattedEndTime: recording.endTime?.toISOString(),
    };
  }

  /**
   * Get basic recording info (for filenames, etc.)
   */
  async getRecordingBasic(recordingId: string) {
    return this.prisma.recording.findUnique({
      where: { id: recordingId },
      select: {
        id: true,
        mediasenseSessionId: true,
        startTime: true,
        agentId: true,
        agentName: true,
        ani: true,
        dnis: true,
        audioFormat: true,
      },
    });
  }

  /**
   * Check if user has access to recording
   */
  async checkAccess(recordingId: string, userId: string, userRole: string): Promise<boolean> {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
      select: { agentId: true, teamCode: true },
    });

    if (!recording) {
      return false;
    }

    try {
      await this._enforceAccess(recording, userId, userRole);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Log audit event (immutable compliance trail)
   */
  async logAuditEvent(params: {
    userId: string;
    action: AuditAction;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { role: true },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        userRole: user?.role || 'USER',
        action: params.action,
        resourceId: params.resourceId,
        filters: params.metadata ? (params.metadata as object) : undefined,
        ipAddress: params.ipAddress,
      },
    });
  }

  /**
   * Log playback event for audit
   */
  async logPlaybackEvent(
    recordingId: string,
    userId: string,
    opts?: { event?: string; position?: number; ipAddress?: string },
  ): Promise<void> {
    const actionMap: Record<string, AuditAction> = {
      play: AuditAction.PLAYBACK_START,
      pause: AuditAction.PLAYBACK_PAUSE,
      seek: AuditAction.PLAYBACK_SEEK,
      complete: AuditAction.PLAYBACK_COMPLETE,
    };
    const action = actionMap[opts?.event || 'play'] ?? AuditAction.PLAYBACK_START;
    await this.logAuditEvent({
      userId,
      action,
      resourceId: recordingId,
      metadata: opts?.position != null ? { position: opts.position } : undefined,
      ipAddress: opts?.ipAddress,
    });
  }

  /**
   * Log record view (opening details)
   */
  async logRecordView(recordingId: string, userId: string, ipAddress?: string): Promise<void> {
    await this.logAuditEvent({
      userId,
      action: AuditAction.RECORD_VIEW,
      resourceId: recordingId,
      ipAddress,
    });
  }

  /**
   * Log record download
   */
  async logRecordDownload(
    recordingId: string,
    userId: string,
    opts?: { format?: string; ipAddress?: string },
  ): Promise<void> {
    await this.logAuditEvent({
      userId,
      action: AuditAction.RECORD_DOWNLOAD,
      resourceId: recordingId,
      metadata: opts?.format ? { format: opts.format } : undefined,
      ipAddress: opts?.ipAddress,
    });
  }

  /**
   * Add tag to recording
   */
  async addTag(recordingId: string, tagName: string, tagValue: string | undefined, userId: string) {
    const tag = await this.prisma.recordingTag.upsert({
      where: {
        recordingId_tagName: { recordingId, tagName },
      },
      create: {
        recordingId,
        tagName,
        tagValue,
        tagSource: 'user',
        createdBy: userId,
      },
      update: {
        tagValue,
      },
    });

    // Re-index in OpenSearch so tag filter and display work
    this.reindexRecordingForTags(recordingId).catch((err) =>
      this.logger.warn(`Failed to re-index recording ${recordingId} for tags`, { error: err?.message }),
    );

    return tag;
  }

  /**
   * Re-index recording in OpenSearch with current tags from DB (for search/filter)
   */
  private async reindexRecordingForTags(recordingId: string): Promise<void> {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
      include: { tags: { select: { tagName: true } } },
    });
    if (!recording) return;

    const tagNames = recording.tags.map((t) => t.tagName);
    await this.openSearchService.indexRecording({
      ...recording,
      tags: tagNames,
      searchText: (recording as any).searchVector,
    });
  }

  /**
   * Add note to recording
   */
  async addNote(recordingId: string, noteText: string, timestamp: number | undefined, userId: string) {
    return this.prisma.recordingNote.create({
      data: {
        recordingId,
        noteText,
        timestamp,
        createdBy: userId,
      },
    });
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    return this.syncService.getSyncStatus();
  }

  /**
   * Trigger manual sync
   */
  async triggerSync() {
    return this.syncService.triggerSyncNow();
  }

  /**
   * Reset sync state
   */
  async resetSync() {
    await this.syncService.resetSyncState();
    return { success: true, message: 'Sync state reset' };
  }

  /**
   * Get sync diagnostics for troubleshooting (config, state, DB count, test fetch)
   */
  async getSyncDiagnostics() {
    return this.syncService.getSyncDiagnostics();
  }

  /**
   * Enforce row-level security
   */
  private async _enforceAccess(recording: any, userId: string, userRole: string): Promise<void> {
    if (userRole === 'ADMIN' || userRole === 'QA') {
      return; // Full access
    }

    if (userRole === 'SUPERVISOR') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { teamCodes: true },
      });

      const teamCodes = user?.teamCodes ?? [];
      // Supervisor without assigned teams: full access (until admin assigns teams)
      if (teamCodes.length === 0) {
        return;
      }
      // Recording without teamCode: allow (legacy data)
      if (!recording.teamCode) {
        return;
      }
      if (teamCodes.includes(recording.teamCode)) {
        return;
      }
      throw new ForbiddenException('Access denied - not your team');
    }

    if (userRole === 'USER') {
      // Check if recording belongs to this agent
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { agentId: true },
      });

      if (user?.agentId === recording.agentId) {
        return;
      }
      throw new ForbiddenException('Access denied - not your recording');
    }

    throw new ForbiddenException('Access denied');
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
