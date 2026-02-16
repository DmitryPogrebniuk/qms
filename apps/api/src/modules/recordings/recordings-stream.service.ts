import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MediaSenseClientService } from '../media-sense/media-sense-client.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { Readable } from 'stream';

/**
 * Recording Stream Service
 *
 * Handles audio streaming from MediaSense with HTTP Range support for browser seeking.
 * Aligns with Cisco MediaSense Developer Guide 9.1(1): playback via HTTP (downloadUrl/wavUrl),
 * Basic Auth + session for media requests, no caching of redirected URL, timeout=n for slow networks.
 */

export interface StreamResult {
  stream: Readable;
  contentType: string;
  contentLength?: number;
  contentRange?: string;
  statusCode: number;
}

export interface AudioAvailability {
  available: boolean;
  format?: string;
  duration?: number;
  size?: number;
  error?: string;
}

@Injectable()
export class RecordingsStreamService {
  private readonly logger = new Logger('RecordingsStreamService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mediaSenseClient: MediaSenseClientService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  /**
   * Check if audio is available for a recording
   */
  async checkAudioAvailability(recordingId: string): Promise<AudioAvailability> {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
      select: {
        hasAudio: true,
        audioFormat: true,
        durationSeconds: true,
        audioSizeBytes: true,
        audioUrl: true,
        mediasenseSessionId: true,
        mediaCheckedAt: true,
      },
    });

    if (!recording) {
      return { available: false, error: 'Recording not found' };
    }

    // If we have stored audio URL from sync (MediaSense wavUrl), treat as available for playback/download
    if (recording.audioUrl) {
      return {
        available: true,
        format: recording.audioFormat || 'wav',
        duration: recording.durationSeconds,
        size: recording.audioSizeBytes ? Number(recording.audioSizeBytes) : undefined,
      };
    }

    // If we already know there's no audio
    if (!recording.hasAudio && recording.mediaCheckedAt) {
      return { available: false, error: 'No audio available' };
    }

    // If we have audio info
    if (recording.hasAudio) {
      return {
        available: true,
        format: recording.audioFormat || 'wav',
        duration: recording.durationSeconds,
        size: recording.audioSizeBytes ? Number(recording.audioSizeBytes) : undefined,
      };
    }

    // Check with MediaSense if not checked recently
    try {
      await this.ensureClientConfigured();
      
      const mediaInfo = await this.mediaSenseClient.getMediaUrl(recording.mediasenseSessionId);
      
      if (mediaInfo.success && mediaInfo.data) {
        // Update recording with audio info
        await this.prisma.recording.update({
          where: { id: recordingId },
          data: {
            hasAudio: true,
            audioUrl: mediaInfo.data,
            mediaCheckedAt: new Date(),
          },
        });

        return {
          available: true,
          format: recording.audioFormat || 'wav',
          duration: recording.durationSeconds,
        };
      }

      // No audio available
      await this.prisma.recording.update({
        where: { id: recordingId },
        data: {
          hasAudio: false,
          mediaCheckedAt: new Date(),
        },
      });

      return { available: false, error: 'Audio not available in MediaSense' };
    } catch (error) {
      this.logger.error(`Error checking audio availability for ${recordingId}:`, error);
      return { available: false, error: 'Failed to check audio availability' };
    }
  }

  /**
   * Stream audio with Range support for seeking.
   * Prefer recording.audioUrl (wavUrl from MediaSense getSessions) when set; else use API streamMedia.
   */
  async streamAudio(recordingId: string, rangeHeader?: string): Promise<StreamResult> {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
      select: {
        mediasenseSessionId: true,
        audioUrl: true,
        audioFormat: true,
        audioSizeBytes: true,
        hasAudio: true,
        startTime: true,
      },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    let audioUrl = recording.audioUrl;
    let canStream = recording.hasAudio || Boolean(audioUrl);

    // If no URL yet but we have sessionId, try getFreshMediaUrl (querySessions or construct URL)
    if (!canStream && recording.mediasenseSessionId) {
      await this.ensureClientConfigured();
      try {
        const startTime = recording.startTime?.toISOString?.() ?? (recording as any).startTime;
        const freshUrl = await this.mediaSenseClient.getFreshMediaUrl(
          recording.mediasenseSessionId,
          startTime,
        );
        if (freshUrl) {
          await this.prisma.recording.update({
            where: { id: recordingId },
            data: { hasAudio: true, audioUrl: freshUrl, mediaCheckedAt: new Date() },
          });
          audioUrl = freshUrl;
          canStream = true;
        }
      } catch {
        // ignore
      }
    }

    if (!canStream) {
      throw new NotFoundException('No audio available for this recording');
    }

    await this.ensureClientConfigured();

    const contentType = this.getContentType(recording.audioFormat || 'wav');

    const tryStream = async (url: string | null): Promise<StreamResult> => {
      if (url) {
        const streamResult = await this.mediaSenseClient.streamFromUrl(url, rangeHeader);
        return {
          stream: streamResult.stream,
          contentType: streamResult.headers['Content-Type'] || contentType,
          contentLength: streamResult.headers['Content-Length']
            ? parseInt(streamResult.headers['Content-Length'], 10)
            : undefined,
          contentRange: streamResult.headers['Content-Range'],
          statusCode: streamResult.statusCode,
        };
      }
      const streamResult = await this.mediaSenseClient.streamMedia(
        recording.mediasenseSessionId!,
        0,
        rangeHeader,
      );
      return {
        stream: streamResult.stream,
        contentType: streamResult.headers['Content-Type'] || contentType,
        contentLength: streamResult.headers['Content-Length']
          ? parseInt(streamResult.headers['Content-Length'], 10)
          : undefined,
        contentRange: streamResult.headers['Content-Range'],
        statusCode: streamResult.statusCode,
      };
    };

    try {
      let result = await tryStream(audioUrl);
      return result;
    } catch (error: any) {
      // On 404, stored audioUrl may be stale - refresh from MediaSense and retry once
      const is404 = error?.message?.includes('404') || error?.response?.status === 404;
      if (is404 && recording.mediasenseSessionId) {
        this.logger.warn(`Stream 404 for ${recordingId}, refreshing URL from MediaSense`);
        try {
          const startTime = recording.startTime?.toISOString?.() ?? (recording as any).startTime;
          const freshUrl = await this.mediaSenseClient.getFreshMediaUrl(
            recording.mediasenseSessionId,
            startTime,
          );
          if (freshUrl) {
            await this.prisma.recording.update({
              where: { id: recordingId },
              data: { audioUrl: freshUrl },
            });
            return tryStream(freshUrl);
          }
        } catch (retryErr) {
          this.logger.warn(`Retry after 404 failed for ${recordingId}:`, (retryErr as Error).message);
        }
      }
      this.logger.error(`Error streaming audio for ${recordingId}:`, error);
      throw error;
    }
  }

  /**
   * Get raw audio stream (for transcoding to MP3 etc).
   * Prefer recording.audioUrl when set.
   */
  async getRawAudioStream(recordingId: string): Promise<{
    stream: Readable;
    format: string;
    size?: number;
  }> {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
      select: {
        mediasenseSessionId: true,
        audioUrl: true,
        audioFormat: true,
        audioSizeBytes: true,
        startTime: true,
      },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    await this.ensureClientConfigured();

    const tryStream = async (url: string | null) => {
      if (url) {
        const streamResult = await this.mediaSenseClient.streamFromUrl(url);
        return streamResult.stream;
      }
      const streamResult = await this.mediaSenseClient.streamMedia(recording.mediasenseSessionId!);
      return streamResult.stream;
    };

    try {
      const stream = await tryStream(recording.audioUrl);
      return {
        stream,
        format: recording.audioFormat || 'wav',
        size: recording.audioSizeBytes ? Number(recording.audioSizeBytes) : undefined,
      };
    } catch (error: any) {
      const is404 = error?.message?.includes('404') || error?.response?.status === 404;
      if (is404 && recording.mediasenseSessionId) {
        this.logger.warn(`Download 404 for ${recordingId}, refreshing URL from MediaSense`);
        try {
          const startTime = recording.startTime?.toISOString?.() ?? (recording as any).startTime;
          const freshUrl = await this.mediaSenseClient.getFreshMediaUrl(
            recording.mediasenseSessionId,
            startTime,
          );
          if (freshUrl) {
            await this.prisma.recording.update({
              where: { id: recordingId },
              data: { audioUrl: freshUrl },
            });
            const stream = await tryStream(freshUrl);
            return {
              stream,
              format: recording.audioFormat || 'wav',
              size: recording.audioSizeBytes ? Number(recording.audioSizeBytes) : undefined,
            };
          }
        } catch (retryErr) {
          this.logger.warn(`Download retry after 404 failed for ${recordingId}:`, (retryErr as Error).message);
        }
      }
      throw error;
    }
  }

  private getContentType(format: string): string {
    const types: Record<string, string> = {
      wav: 'audio/wav',
      wave: 'audio/wav',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg',
      au: 'audio/basic',
      alaw: 'audio/basic',
      ulaw: 'audio/basic',
    };
    return types[format.toLowerCase()] || 'audio/octet-stream';
  }

  /**
   * Get MediaSense config from IntegrationSetting (DB/UI) or env vars.
   * Must match sync service source so stream/download use same credentials as sync.
   */
  private async ensureClientConfigured(): Promise<void> {
    // 1) Prefer IntegrationSetting (DB) - same source as sync, supports UI configuration
    const integration = await this.integrationsService.getIntegration('mediasense');
    if (integration?.enabled && integration?.configured && integration.settings) {
      const { apiUrl, apiKey, apiSecret, allowSelfSigned } = integration.settings as Record<string, any>;
      if (apiUrl && apiKey && apiSecret) {
        this.mediaSenseClient.configure({
          baseUrl: apiUrl,
          apiKey,
          apiSecret,
          allowSelfSigned: allowSelfSigned === true || allowSelfSigned === 'true',
          manualJSessionId: process.env.MEDIASENSE_JSESSIONID,
        });
        return;
      }
    }

    // 2) Fallback to env vars
    let baseUrl = this.configService.get<string>('MEDIASENSE_API_URL');
    let apiKey = this.configService.get<string>('MEDIASENSE_API_KEY');
    let apiSecret = this.configService.get<string>('MEDIASENSE_API_SECRET');
    if (!baseUrl && this.configService.get<string>('MEDIASENSE_HOST')) {
      const host = this.configService.get<string>('MEDIASENSE_HOST');
      const port = this.configService.get<number>('MEDIASENSE_PORT') || 8440;
      baseUrl = `https://${host}:${port}`;
    }
    if (!apiKey) apiKey = this.configService.get<string>('MEDIASENSE_USERNAME') ?? undefined;
    if (!apiSecret) apiSecret = this.configService.get<string>('MEDIASENSE_PASSWORD') ?? undefined;
    const allowSelfSigned = this.configService.get<boolean>('MEDIASENSE_ALLOW_SELF_SIGNED');

    if (!baseUrl || !apiKey || !apiSecret) {
      throw new Error(
        'MediaSense not configured. Set in Settings → Integrations → MediaSense, or env: MEDIASENSE_HOST/MEDIASENSE_USERNAME/MEDIASENSE_PASSWORD',
      );
    }

    this.mediaSenseClient.configure({
      baseUrl,
      apiKey,
      apiSecret,
      allowSelfSigned,
      manualJSessionId: process.env.MEDIASENSE_JSESSIONID,
    });
  }
}
