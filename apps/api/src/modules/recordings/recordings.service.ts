import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Role, SearchRequest, SearchFilters, PaginatedResponse } from '@/types/shared';

@Injectable()
export class RecordingsService {
  private readonly logger = new Logger('RecordingsService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search recordings with RBAC enforcement
   */
  async searchRecordings(
    request: SearchRequest,
    userId: string,
    userRole: string,
    userTeamCodes: string[],
  ): Promise<PaginatedResponse<any>> {
    // Build where clause based on RBAC
    const where: any = {
      AND: [],
    };

    // Date filters
    if (request.filters.dateFrom) {
      where.AND.push({ startTime: { gte: request.filters.dateFrom } });
    }
    if (request.filters.dateTo) {
      where.AND.push({ startTime: { lte: request.filters.dateTo } });
    }

    // Role-based filtering
    if (userRole === 'USER') {
      // USER can only see their own recordings
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user?.agentId) {
        return {
          data: [],
          total: 0,
          page: request.page,
          pageSize: request.pageSize,
          totalPages: 0,
        };
      }
      where.AND.push({ agentId: user.agentId });
    } else if (userRole === 'SUPERVISOR') {
      // SUPERVISOR can see team recordings only
      where.AND.push({ teamCode: { in: userTeamCodes } });
    }
    // QA and ADMIN can see all recordings

    // Apply additional filters
    if (request.filters.agentIds?.length) {
      where.AND.push({ agentId: { in: request.filters.agentIds } });
    }
    if (request.filters.teamCodes?.length) {
      where.AND.push({ teamCode: { in: request.filters.teamCodes } });
    }
    if (request.filters.csqs?.length) {
      where.AND.push({ csq: { in: request.filters.csqs } });
    }
    if (request.filters.callIds?.length) {
      where.AND.push({ callId: { in: request.filters.callIds } });
    }

    // Get total count
    const total = await this.prisma.recording.count({ where });

    // Get paginated results
    const skip = (request.page - 1) * request.pageSize;
    const sortField = request.sort?.field || 'startTime';
    const sortOrder = request.sort?.order || 'desc';
    const data = await this.prisma.recording.findMany({
      where,
      skip,
      take: request.pageSize,
      orderBy: {
        [sortField]: sortOrder,
      },
      include: {
        agent: { select: { fullName: true } },
        team: { select: { displayName: true } },
      },
    });

    return {
      data,
      total,
      page: request.page,
      pageSize: request.pageSize,
      totalPages: Math.ceil(total / request.pageSize),
    };
  }

  /**
   * Get recording details
   */
  async getRecordingDetails(recordingId: string, userId: string, userRole: string) {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
      include: {
        agent: true,
        team: true,
        evaluation: {
          include: {
            scorecard: true,
            bookmarks: true,
            disputes: true,
          },
        },
      },
    });

    if (!recording) {
      throw new BadRequestException('Recording not found');
    }

    // Check access
    this._enforceAccess(recording, userId, userRole);

    return recording;
  }

  /**
   * Enforce row-level security
   */
  private _enforceAccess(recording: any, userId: string, userRole: string): void {
    if (userRole === 'ADMIN' || userRole === 'QA') {
      return; // Full access
    }
    // Additional checks for SUPERVISOR and USER would go here
  }
}
