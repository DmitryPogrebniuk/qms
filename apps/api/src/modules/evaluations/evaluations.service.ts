import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger('EvaluationsService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create evaluation
   */
  async createEvaluation(
    createDto: any,
    evaluatorId: string,
    userRole: string,
  ) {
    if (!['QA', 'SUPERVISOR', 'ADMIN'].includes(userRole)) {
      throw new ForbiddenException('Only QA, SUPERVISOR, or ADMIN can create evaluations');
    }

    // Get recording/chat for agent and team info
    let agentId = createDto.agentId;
    let teamCode = createDto.teamCode;

    if (createDto.recordingId) {
      const recording = await this.prisma.recording.findUnique({
        where: { id: createDto.recordingId },
      });
      if (!recording) {
        throw new BadRequestException('Recording not found');
      }
      agentId = recording.agentId;
      teamCode = recording.teamCode;
    }

    return this.prisma.evaluation.create({
      data: {
        recordingId: createDto.recordingId,
        chatId: createDto.chatId,
        scorecardTemplateId: createDto.scorecardTemplateId,
        evaluatorId,
        agentId,
        teamCode,
        responses: createDto.responses || [],
        status: 'DRAFT',
      },
      include: {
        scorecard: true,
        evaluator: { select: { fullName: true } },
      },
    });
  }

  /**
   * Submit evaluation
   */
  async submitEvaluation(evaluationId: string, evaluatorId: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
    });

    if (!evaluation) {
      throw new BadRequestException('Evaluation not found');
    }

    if (evaluation.evaluatorId !== evaluatorId) {
      throw new ForbiddenException('Can only submit your own evaluations');
    }

    // Calculate total score
    const responses = evaluation.responses as any[];
    const scorecard = await this.prisma.scorecardTemplate.findUnique({
      where: { id: evaluation.scorecardTemplateId },
    });

    let totalScore = 0;
    let maxScore = 0;

    return this.prisma.evaluation.update({
      where: { id: evaluationId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        totalScore,
      },
    });
  }

  /**
   * Get evaluations for agent
   */
  async getAgentEvaluations(agentId: string, page: number, pageSize: number) {
    const total = await this.prisma.evaluation.count({
      where: { agentId },
    });

    const data = await this.prisma.evaluation.findMany({
      where: { agentId },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        recording: { select: { callId: true, startTime: true } },
        scorecard: { select: { name: true } },
        evaluator: { select: { fullName: true } },
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
}
