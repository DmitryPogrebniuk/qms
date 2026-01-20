import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { SearchRequest, PaginatedResponse } from '@/types/shared';

@Injectable()
export class ChatsService {
  private readonly logger = new Logger('ChatsService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search chats with RBAC
   */
  async searchChats(
    request: SearchRequest,
    userId: string,
    userRole: string,
    userTeamCodes: string[],
  ): Promise<PaginatedResponse<any>> {
    const where: any = { AND: [] };

    if (request.filters.dateFrom) {
      where.AND.push({ startTime: { gte: request.filters.dateFrom } });
    }
    if (request.filters.dateTo) {
      where.AND.push({ startTime: { lte: request.filters.dateTo } });
    }

    if (userRole === 'USER') {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user?.agentId) {
        return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
      }
      where.AND.push({ agentId: user.agentId });
    } else if (userRole === 'SUPERVISOR') {
      where.AND.push({ teamCode: { in: userTeamCodes } });
    }

    const total = await this.prisma.chat.count({ where });
    const skip = (request.page - 1) * request.pageSize;

    const data = await this.prisma.chat.findMany({
      where,
      skip,
      take: request.pageSize,
      orderBy: { startTime: 'desc' },
      include: {
        agent: { select: { fullName: true } },
        messages: { take: 5, orderBy: { timestamp: 'desc' } },
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
   * Get chat details
   */
  async getChatDetails(chatId: string) {
    return this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        agent: true,
        messages: { orderBy: { timestamp: 'asc' } },
        evaluation: true,
      },
    });
  }
}
