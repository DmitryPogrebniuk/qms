import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import https from 'https';

/**
 * Ingests recording metadata from MediaSense incrementally
 */
@Injectable()
export class MediaSenseIngestionService {
  private readonly logger = new Logger('MediaSenseIngestionService');
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Incremental metadata ingestion (every 30 minutes)
   * DISABLED: Using MediaSenseSyncService instead which uses correct API endpoints
   */
  // @Cron('*/30 * * * *')
  async ingestMetadata(): Promise<void> {
    // DISABLED: This service uses incorrect /api/recordings endpoint
    // Use MediaSenseSyncService instead which uses proper /ora/queryService/query/sessions
    this.logger.warn('MediaSenseIngestionService is disabled. Use MediaSenseSyncService instead.');
    return;
    this.logger.log('Starting MediaSense metadata ingestion...');
    try {
      const syncState = await this.prisma.syncState.findUnique({
        where: { syncType: 'mediasense_metadata' },
      });

      const watermark = syncState?.watermark || new Date(Date.now() - 86400000).toISOString(); // Last 24h

      await this.prisma.syncState.upsert({
        where: { syncType: 'mediasense_metadata' },
        update: { status: 'IN_PROGRESS' },
        create: { syncType: 'mediasense_metadata', status: 'IN_PROGRESS' },
      });

      let processed = 0;
      let lastWatermark = watermark;
      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        const batch = await this._fetchRecordingMetadata(watermark, offset);
        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        for (const recording of batch) {
          await this._processRecordingMetadata(recording);
          lastWatermark = recording.startTime;
          processed++;
        }

        offset += batch.length;
        if (batch.length < 100) hasMore = false;
      }

      await this.prisma.syncState.update({
        where: { syncType: 'mediasense_metadata' },
        data: {
          status: 'SUCCESS',
          lastSyncedAt: new Date(),
          watermark: lastWatermark,
          errorMessage: null,
        },
      });

      this.logger.log(`Ingested ${processed} recording metadata entries`);
    } catch (error) {
      this.logger.error('Metadata ingestion failed:', error);
      await this.prisma.syncState.update({
        where: { syncType: 'mediasense_metadata' },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Fetch recording metadata from MediaSense
   */
  private async _fetchRecordingMetadata(watermark: string, offset: number): Promise<any[]> {
    const host = this.configService.get<string>('MEDIASENSE_HOST');
    const port = this.configService.get<number>('MEDIASENSE_PORT');
    const username = this.configService.get<string>('MEDIASENSE_USERNAME');
    const password = this.configService.get<string>('MEDIASENSE_PASSWORD');
    const batchSize = this.configService.get<number>('MEDIASENSE_BATCH_SIZE') || 100;

    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    try {
      const response = await this.httpService.axiosRef.get(
        `https://${host}:${port}/api/recordings?startTime=${watermark}&limit=${batchSize}&offset=${offset}`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
          },
          httpsAgent: this.httpsAgent,
        },
      );

      return response.data?.recordings || [];
    } catch (error) {
      this.logger.error('MediaSense fetch error:', error);
      throw error;
    }
  }

  /**
   * Process and store recording metadata
   */
  private async _processRecordingMetadata(recording: any): Promise<void> {
    try {
      await this.prisma.recording.upsert({
        where: { mediasenseSessionId: recording.sessionId || recording.mediasenseSessionId || '' },
        update: {
          endTime: new Date(recording.endTime),
          durationSeconds: recording.duration,
          isArchived: recording.archived,
          rawMetadata: recording,
          updatedAt: new Date(),
        },
        create: {
          mediasenseSessionId: recording.sessionId || recording.mediasenseSessionId || '',
          mediasenseRecordingId: recording.recordingId,
          agentId: recording.agentId || 'UNKNOWN',
          teamCode: recording.teamCode || 'UNKNOWN',
          startTime: new Date(recording.startTime),
          endTime: new Date(recording.endTime),
          durationSeconds: recording.duration,
          contactId: recording.contactId,
          callId: recording.callId,
          direction: recording.direction || 'unknown',
          ani: recording.ani,
          dnis: recording.dnis,
          csq: recording.csq,
          transferCount: recording.transferCount,
          holdTimeSeconds: recording.holdTime,
          isArchived: recording.archived,
          rawMetadata: recording,
        },
      });
    } catch (error) {
      this.logger.error(`Error processing recording ${recording.recordingId}:`, error);
      // Non-fatal: continue processing others
    }
  }
}
