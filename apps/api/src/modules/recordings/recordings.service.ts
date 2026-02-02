import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { MediaSenseSyncService } from '../media-sense/media-sense-sync.service';
import { AuditAction } from '@prisma/client';

@Injectable()
export class RecordingsService {
  private readonly logger = new Logger('RecordingsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: MediaSenseSyncService,
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
            scorecard: { select: { id: true, name: true } },
            bookmarks: true,
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
   * Log playback event for audit
   */
  async logPlaybackEvent(recordingId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        userRole: user?.role || 'USER',
        action: AuditAction.PLAYBACK_START,
        resourceId: recordingId,
      },
    });
  }

  /**
   * Add tag to recording
   */
  async addTag(recordingId: string, tagName: string, tagValue: string | undefined, userId: string) {
    return this.prisma.recordingTag.upsert({
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
      // Check if recording is in supervisor's teams
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { teamCodes: true },
      });

      if (user?.teamCodes?.includes(recording.teamCode)) {
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
