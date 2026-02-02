import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MediaSenseClientService } from '../media-sense/media-sense-client.service';
import { Readable } from 'stream';

/**
 * Recording Stream Service
 * 
 * Handles audio streaming from MediaSense with HTTP Range support for browser seeking
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
      },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    let audioUrl = recording.audioUrl;
    let canStream = recording.hasAudio || Boolean(audioUrl);

    // If no URL yet but we have sessionId, try to get media URL from MediaSense once
    if (!canStream && recording.mediasenseSessionId) {
      await this.ensureClientConfigured();
      try {
        const mediaInfo = await this.mediaSenseClient.getMediaUrl(recording.mediasenseSessionId);
        if (mediaInfo.success && mediaInfo.data) {
          await this.prisma.recording.update({
            where: { id: recordingId },
            data: { hasAudio: true, audioUrl: mediaInfo.data, mediaCheckedAt: new Date() },
          });
          audioUrl = mediaInfo.data;
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

    try {
      // Prefer direct URL from sync (MediaSense 11.5 urls.wavUrl) when available
      if (audioUrl) {
        const streamResult = await this.mediaSenseClient.streamFromUrl(
          audioUrl,
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
      }

      // Fallback: stream via API endpoint
      const streamResult = await this.mediaSenseClient.streamMedia(
        recording.mediasenseSessionId,
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
    } catch (error) {
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
      },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    await this.ensureClientConfigured();

    if (recording.audioUrl) {
      const streamResult = await this.mediaSenseClient.streamFromUrl(recording.audioUrl);
      return {
        stream: streamResult.stream,
        format: recording.audioFormat || 'wav',
        size: recording.audioSizeBytes ? Number(recording.audioSizeBytes) : undefined,
      };
    }

    const streamResult = await this.mediaSenseClient.streamMedia(
      recording.mediasenseSessionId,
    );

    return {
      stream: streamResult.stream,
      format: recording.audioFormat || 'wav',
      size: recording.audioSizeBytes ? Number(recording.audioSizeBytes) : undefined,
    };
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

  private async ensureClientConfigured(): Promise<void> {
    const apiUrl = this.configService.get<string>('MEDIASENSE_API_URL');
    const apiKey = this.configService.get<string>('MEDIASENSE_API_KEY');
    const apiSecret = this.configService.get<string>('MEDIASENSE_API_SECRET');
    const allowSelfSigned = this.configService.get<boolean>('MEDIASENSE_ALLOW_SELF_SIGNED');

    if (!apiUrl || !apiKey || !apiSecret) {
      throw new Error('MediaSense not configured');
    }

    this.mediaSenseClient.configure({
      baseUrl: apiUrl,
      apiKey,
      apiSecret,
      allowSelfSigned,
    });
  }
}
