import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class CoachingService {
  private readonly logger = new Logger('CoachingService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create coaching plan from evaluation
   */
  async createCoachingPlan(evaluationId: string, createDto: any, supervisorId: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
    });

    if (!evaluation) {
      throw new BadRequestException('Evaluation not found');
    }

    return this.prisma.coachingPlan.create({
      data: {
        evaluationId,
        agentId: evaluation.agentId,
        supervisorId,
        teamCode: evaluation.teamCode,
        actionItems: createDto.actionItems || [],
        status: 'ACTIVE',
      },
      include: {
        agent: { select: { fullName: true } },
        supervisor: { select: { fullName: true } },
      },
    });
  }

  /**
   * Get coaching plans for agent
   */
  async getAgentCoachingPlans(agentId: string, page: number, pageSize: number) {
    const total = await this.prisma.coachingPlan.count({
      where: { agentId },
    });

    const data = await this.prisma.coachingPlan.findMany({
      where: { agentId },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        evaluation: { select: { status: true } },
        supervisor: { select: { fullName: true } },
      },
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update coaching plan status
   */
  async updateCoachingPlanStatus(coachingPlanId: string, status: string) {
    return this.prisma.coachingPlan.update({
      where: { id: coachingPlanId },
      data: { status: status as any },
    });
  }
}
