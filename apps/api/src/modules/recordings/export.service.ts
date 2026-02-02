import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RecordingsStreamService } from './recordings-stream.service';
import { ExportStatus } from '@prisma/client';
import { spawn } from 'child_process';
import { createWriteStream, createReadStream, existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

/**
 * Export Service
 * 
 * Handles MP3/audio transcoding using FFmpeg
 * Supports both synchronous (small files) and async (large files) export
 */

export interface DownloadResult {
  status: 'ready' | 'processing' | 'error';
  stream?: Readable;
  contentType?: string;
  contentLength?: number;
  /** When fallback to source format (e.g. wav) instead of requested mp3 */
  actualFormat?: string;
  jobId?: string;
  error?: string;
}

export interface ExportJob {
  id: string;
  recordingId: string;
  format: string;
  quality: string;
  status: string;
  progress: number;
  requestedBy: string;
  outputPath?: string;
  outputSizeBytes?: bigint;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

@Injectable()
export class ExportService implements OnModuleInit {
  private readonly logger = new Logger('ExportService');
  private readonly exportDir: string;
  private readonly maxSyncDuration = 60; // seconds - above this, use async
  private ffmpegAvailable = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly streamService: RecordingsStreamService,
  ) {
    this.exportDir = configService.get<string>('EXPORT_DIR') || '/tmp/qms-exports';
  }

  async onModuleInit() {
    // Create export directory
    if (!existsSync(this.exportDir)) {
      mkdirSync(this.exportDir, { recursive: true });
    }

    // Check FFmpeg availability
    this.ffmpegAvailable = await this.checkFfmpeg();
    if (!this.ffmpegAvailable) {
      this.logger.warn('FFmpeg not available - MP3 transcoding disabled');
    }
  }

  /**
   * Get or create download for a recording
   * Will return cached file, or transcode on-the-fly for small files,
   * or create async job for large files
   */
  async getOrCreateDownload(
    recordingId: string,
    format: string,
    userId: string,
  ): Promise<DownloadResult> {
    // Check for existing completed export
    const existingJob = await this.prisma.exportJob.findFirst({
      where: {
        recordingId,
        format,
        status: ExportStatus.COMPLETED,
        downloadExpiresAt: { gt: new Date() },
      },
      orderBy: { completedAt: 'desc' },
    });

    if (existingJob && existingJob.outputPath && existsSync(existingJob.outputPath)) {
      // Return cached file
      const stat = statSync(existingJob.outputPath);
      return {
        status: 'ready',
        stream: createReadStream(existingJob.outputPath),
        contentType: this.getContentType(format),
        contentLength: stat.size,
      };
    }

    // Check for in-progress job
    const pendingJob = await this.prisma.exportJob.findFirst({
      where: {
        recordingId,
        format,
        status: { in: [ExportStatus.PENDING, ExportStatus.PROCESSING] },
      },
    });

    if (pendingJob) {
      return {
        status: 'processing',
        jobId: pendingJob.id,
      };
    }

    // Get recording info (hasAudio or audioUrl = can stream/download)
    let recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
      select: { durationSeconds: true, audioFormat: true, hasAudio: true, audioUrl: true, mediasenseSessionId: true },
    });

    let canStream = recording && (recording.hasAudio || Boolean(recording.audioUrl));
    // Якщо немає audioUrl але є mediasenseSessionId — спробувати отримати URL з MediaSense (он-деманд)
    if (!canStream && recording?.mediasenseSessionId) {
      const availability = await this.streamService.checkAudioAvailability(recordingId);
      if (availability.available) {
        recording = await this.prisma.recording.findUnique({
          where: { id: recordingId },
          select: { durationSeconds: true, audioFormat: true, hasAudio: true, audioUrl: true },
        });
        canStream = Boolean(recording?.hasAudio || recording?.audioUrl);
      } else {
        return { status: 'error', error: availability.error || 'Recording has no audio' };
      }
    }
    if (!canStream) {
      return { status: 'error', error: 'Recording has no audio' };
    }

    // Check if source format matches requested format (no transcode needed)
    if (recording.audioFormat?.toLowerCase() === format.toLowerCase()) {
      // Stream directly
      const streamResult = await this.streamService.streamAudio(recordingId);
      return {
        status: 'ready',
        stream: streamResult.stream,
        contentType: streamResult.contentType,
        contentLength: streamResult.contentLength,
      };
    }

    // Need transcoding — якщо ffmpeg немає, віддаємо вихідний формат (WAV)
    if (!this.ffmpegAvailable) {
      const streamResult = await this.streamService.streamAudio(recordingId);
      return {
        status: 'ready',
        stream: streamResult.stream,
        contentType: 'audio/wav',
        contentLength: streamResult.contentLength,
        actualFormat: 'wav',
      };
    }

    // Small file - transcode synchronously
    if (recording.durationSeconds <= this.maxSyncDuration) {
      try {
        const result = await this.transcodeSync(recordingId, format, userId);
        return result;
      } catch (error) {
        return { status: 'error', error: (error as Error).message };
      }
    }

    // Large file - create async job
    const job = await this.createExportJob(recordingId, format, 'standard', userId);
    
    // Start processing in background
    this.processExportJob(job.id).catch(err => {
      this.logger.error(`Export job ${job.id} failed:`, err);
    });

    return {
      status: 'processing',
      jobId: job.id,
    };
  }

  /**
   * Create async export job
   */
  async createExportJob(
    recordingId: string,
    format: string,
    quality: string,
    userId: string,
  ): Promise<ExportJob> {
    const job = await this.prisma.exportJob.create({
      data: {
        recordingId,
        format,
        quality,
        status: ExportStatus.PENDING,
        requestedBy: userId,
      },
    });

    return job as ExportJob;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ExportJob | null> {
    return this.prisma.exportJob.findUnique({
      where: { id: jobId },
    }) as Promise<ExportJob | null>;
  }

  /**
   * Get exported file
   */
  async getExportedFile(jobId: string): Promise<{
    success: boolean;
    stream?: Readable;
    contentType?: string;
    contentLength?: number;
    error?: string;
  }> {
    const job = await this.prisma.exportJob.findUnique({
      where: { id: jobId },
    });

    if (!job || job.status !== ExportStatus.COMPLETED || !job.outputPath) {
      return { success: false, error: 'Export not ready' };
    }

    if (!existsSync(job.outputPath)) {
      return { success: false, error: 'Export file not found' };
    }

    const stat = statSync(job.outputPath);
    return {
      success: true,
      stream: createReadStream(job.outputPath),
      contentType: this.getContentType(job.format),
      contentLength: stat.size,
    };
  }

  /**
   * Transcode synchronously for small files
   */
  private async transcodeSync(
    recordingId: string,
    format: string,
    userId: string,
  ): Promise<DownloadResult> {
    const outputPath = join(this.exportDir, `${recordingId}-${Date.now()}.${format}`);

    try {
      // Get source stream
      const sourceStream = await this.streamService.getRawAudioStream(recordingId);

      // Transcode
      await this.transcode(sourceStream.stream, sourceStream.format, outputPath, format);

      // Create job record for tracking
      const stat = statSync(outputPath);
      await this.prisma.exportJob.create({
        data: {
          recordingId,
          format,
          quality: 'standard',
          status: ExportStatus.COMPLETED,
          requestedBy: userId,
          outputPath,
          outputSizeBytes: BigInt(stat.size),
          completedAt: new Date(),
          downloadExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h TTL
        },
      });

      return {
        status: 'ready',
        stream: createReadStream(outputPath),
        contentType: this.getContentType(format),
        contentLength: stat.size,
      };
    } catch (error) {
      // Clean up on error
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
      throw error;
    }
  }

  /**
   * Process async export job
   */
  async processExportJob(jobId: string): Promise<void> {
    const job = await this.prisma.exportJob.findUnique({
      where: { id: jobId },
    });

    if (!job || job.status !== ExportStatus.PENDING) {
      return;
    }

    const outputPath = join(this.exportDir, `${job.recordingId}-${jobId}.${job.format}`);

    try {
      // Update status
      await this.prisma.exportJob.update({
        where: { id: jobId },
        data: {
          status: ExportStatus.PROCESSING,
          startedAt: new Date(),
        },
      });

      // Get source stream
      const sourceStream = await this.streamService.getRawAudioStream(job.recordingId);

      // Transcode
      await this.transcode(sourceStream.stream, sourceStream.format, outputPath, job.format);

      // Update job
      const stat = statSync(outputPath);
      await this.prisma.exportJob.update({
        where: { id: jobId },
        data: {
          status: ExportStatus.COMPLETED,
          progress: 100,
          outputPath,
          outputSizeBytes: BigInt(stat.size),
          completedAt: new Date(),
          downloadExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h TTL
        },
      });

      this.logger.log(`Export job ${jobId} completed`);
    } catch (error) {
      // Clean up on error
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }

      await this.prisma.exportJob.update({
        where: { id: jobId },
        data: {
          status: ExportStatus.FAILED,
          errorMessage: (error as Error).message,
        },
      });

      throw error;
    }
  }

  /**
   * Transcode audio using FFmpeg
   */
  private async transcode(
    inputStream: Readable,
    inputFormat: string,
    outputPath: string,
    outputFormat: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // FFmpeg options based on output format
      const ffmpegArgs = [
        '-i', 'pipe:0', // Read from stdin
        '-y', // Overwrite output
      ];

      switch (outputFormat.toLowerCase()) {
        case 'mp3':
          ffmpegArgs.push(
            '-codec:a', 'libmp3lame',
            '-b:a', '128k', // Bitrate
            '-ar', '44100', // Sample rate
            '-ac', '2', // Stereo
          );
          break;

        case 'ogg':
          ffmpegArgs.push(
            '-codec:a', 'libvorbis',
            '-q:a', '4', // Quality
          );
          break;

        case 'wav':
          ffmpegArgs.push(
            '-codec:a', 'pcm_s16le',
          );
          break;

        default:
          reject(new Error(`Unsupported output format: ${outputFormat}`));
          return;
      }

      ffmpegArgs.push(outputPath);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(err);
      });

      // Pipe input stream to FFmpeg
      inputStream.pipe(ffmpeg.stdin);

      inputStream.on('error', (err) => {
        ffmpeg.kill();
        reject(err);
      });
    });
  }

  /**
   * Check if FFmpeg is available
   */
  private async checkFfmpeg(): Promise<boolean> {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      ffmpeg.on('close', (code) => {
        resolve(code === 0);
      });

      ffmpeg.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Get content type for format
   */
  private getContentType(format: string): string {
    const types: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
    };
    return types[format.toLowerCase()] || 'audio/octet-stream';
  }

  /**
   * Cleanup old export files
   */
  async cleanupExpiredExports(): Promise<number> {
    const expiredJobs = await this.prisma.exportJob.findMany({
      where: {
        status: ExportStatus.COMPLETED,
        downloadExpiresAt: { lt: new Date() },
        outputPath: { not: null },
      },
    });

    let deleted = 0;
    for (const job of expiredJobs) {
      if (job.outputPath && existsSync(job.outputPath)) {
        try {
          unlinkSync(job.outputPath);
          deleted++;
        } catch (e) {
          this.logger.warn(`Failed to delete ${job.outputPath}:`, e);
        }
      }

      await this.prisma.exportJob.update({
        where: { id: job.id },
        data: {
          status: ExportStatus.EXPIRED,
          outputPath: null,
        },
      });
    }

    this.logger.log(`Cleaned up ${deleted} expired export files`);
    return deleted;
  }
}
