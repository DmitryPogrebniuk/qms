import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '@/common/prisma/prisma.service';
import https from 'https';

/**
 * Secure streaming proxy for audio files from MediaSense
 */
@Injectable()
export class MediaSenseStreamService {
  private readonly logger = new Logger('MediaSenseStreamService');
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get stream URL for recording (requires auth + access check)
   */
  async getStreamUrl(recordingId: string): Promise<string> {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new BadRequestException('Recording not found');
    }

    const host = this.configService.get<string>('MEDIASENSE_HOST');
    const port = this.configService.get<number>('MEDIASENSE_PORT');

    // Return MediaSense streaming URL
    // TODO: In production, would get signed URL from MediaSense
    return `https://${host}:${port}/api/recordings/${recording.mediasenseRecordingId}/stream`;
  }

  /**
   * Stream audio bytes with Range support
   */
  async streamRecording(recordingId: string, rangeHeader?: string): Promise<any> {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new BadRequestException('Recording not found');
    }

    const host = this.configService.get<string>('MEDIASENSE_HOST');
    const port = this.configService.get<number>('MEDIASENSE_PORT');
    const username = this.configService.get<string>('MEDIASENSE_USERNAME');
    const password = this.configService.get<string>('MEDIASENSE_PASSWORD');

    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    try {
      const response = await this.httpService.axiosRef.get(
        `https://${host}:${port}/api/recordings/${recording.mediasenseRecordingId}/stream`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            ...(rangeHeader && { Range: rangeHeader }),
          },
          httpsAgent: this.httpsAgent,
          responseType: 'stream',
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Stream error for recording ${recordingId}:`, error);
      throw error;
    }
  }
}
