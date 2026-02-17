import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { OpenSearchService } from '../opensearch/opensearch.service';

export interface AccessControl {
  userId: string;
  role: string;
  agentId?: string;
  teamCodes?: string[];
}

@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger('EvaluationsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly openSearchService: OpenSearchService,
  ) {}

  /**
   * Calculate evaluation score from answers
   * sectionScore = sum(answerScore * questionWeight)
   * finalScore = sum(sectionScore * sectionWeight)
   * If any CRITICAL fail: finalScore = 0
   */
  async calculateEvaluationScore(evaluationId: string): Promise<number> {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: {
        answers: { include: { question: { include: { section: true } } } },
        scorecard: { include: { sections: { include: { questions: true } } } },
      },
    });

    if (!evaluation?.scorecardId || !evaluation.scorecard) {
      return 0;
    }

    const scorecard = evaluation.scorecard;
    let hasCriticalFail = false;

    for (const answer of evaluation.answers) {
      if (answer.question.isCritical && answer.question.type === 'CRITICAL') {
        const passed = this._isCriticalPassed(answer.question, answer.value);
        if (!passed) {
          hasCriticalFail = true;
          break;
        }
      }
    }

    if (hasCriticalFail) {
      return 0;
    }

    let finalScore = 0;
    let totalWeight = 0;

    for (const section of scorecard.sections) {
      let sectionScore = 0;
      let sectionMaxScore = 0;

      for (const question of section.questions) {
        const answer = evaluation.answers.find((a) => a.questionId === question.id);
        const { score, maxScore } = this._computeQuestionScore(question, answer);
        sectionScore += score * question.weight;
        sectionMaxScore += maxScore * question.weight;
      }

      if (sectionMaxScore > 0) {
        const sectionContribution = (sectionScore / sectionMaxScore) * section.weight;
        finalScore += sectionContribution;
      }
      totalWeight += section.weight;
    }

    return totalWeight > 0 ? (finalScore / totalWeight) * 100 : 0;
  }

  private _isCriticalPassed(question: { type: string; options?: unknown }, value?: string | null): boolean {
    if (question.type !== 'CRITICAL') return true;
    if (!value) return false;
    const v = value.toLowerCase();
    return v === 'yes' || v === 'true' || v === '1' || v === 'pass';
  }

  private _computeQuestionScore(
    question: { type: string; options?: unknown },
    answer?: { value?: string | null; score?: number | null },
  ): { score: number; maxScore: number } {
    switch (question.type) {
      case 'YES_NO':
        if (!answer?.value) return { score: 0, maxScore: 1 };
        const yesNo = answer.value.toLowerCase();
        return { score: yesNo === 'yes' ? 1 : 0, maxScore: 1 };
      case 'SCALE': {
        const opts = question.options as { min?: number; max?: number } | undefined;
        const min = opts?.min ?? 1;
        const max = opts?.max ?? 5;
        const val = answer?.value ? parseFloat(answer.value) : 0;
        return { score: Math.min(max, Math.max(min, val)), maxScore: max };
      }
      case 'CRITICAL':
        return this._isCriticalPassed(question, answer?.value)
          ? { score: 1, maxScore: 1 }
          : { score: 0, maxScore: 1 };
      case 'TEXT':
      case 'DROPDOWN':
      default:
        return { score: answer?.score ?? 0, maxScore: 1 };
    }
  }

  /**
   * Create evaluation (legacy or new scorecard)
   */
  async createEvaluation(
    createDto: {
      recordingId?: string;
      chatId?: string;
      scorecardTemplateId?: string;
      scorecardId?: string;
      agentId?: string;
      teamCode?: string;
      responses?: unknown[];
      answers?: Array<{ questionId: string; value?: string; score?: number; comment?: string }>;
    },
    evaluatorId: string,
    userRole: string,
  ) {
    if (!['QA', 'SUPERVISOR', 'ADMIN'].includes(userRole)) {
      throw new ForbiddenException('Only QA, SUPERVISOR, or ADMIN can create evaluations');
    }

    let agentId = createDto.agentId;
    let teamCode = createDto.teamCode;

    if (createDto.recordingId) {
      const recording = await this.prisma.recording.findUnique({
        where: { id: createDto.recordingId },
      });
      if (!recording) throw new BadRequestException('Recording not found');
      agentId = recording.agentId ?? undefined;
      teamCode = recording.teamCode ?? undefined;
    }

    if (!agentId || !teamCode) {
      throw new BadRequestException('Agent and team are required');
    }

    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new BadRequestException('Agent not found');

    if (createDto.scorecardId && createDto.recordingId) {
      const scorecard = await this.prisma.scorecard.findUnique({
        where: { id: createDto.scorecardId },
      });
      if (!scorecard) throw new BadRequestException('Scorecard not found');

      if (createDto.recordingId) {
        const existing = await this.prisma.evaluation.findUnique({
          where: { recordingId: createDto.recordingId },
        });
        if (existing) throw new BadRequestException('Recording already has an evaluation');
      }

      const evaluation = await this.prisma.evaluation.create({
        data: {
          recordingId: createDto.recordingId,
          chatId: createDto.chatId,
          scorecardId: createDto.scorecardId,
          evaluatorId,
          agentId,
          teamCode,
          status: 'DRAFT',
          answers: {
            create: (createDto.answers || []).map((a) => ({
              questionId: a.questionId,
              value: a.value,
              score: a.score,
              comment: a.comment,
            })),
          },
        },
        include: {
          scorecard: { include: { sections: { include: { questions: true } } } },
          evaluator: { select: { fullName: true } },
          agent: { select: { agentId: true, fullName: true } },
          answers: { include: { question: true } },
        },
      });

      const finalScore = await this.calculateEvaluationScore(evaluation.id);
      await this.prisma.evaluation.update({
        where: { id: evaluation.id },
        data: { finalScore },
      });

      return { ...evaluation, finalScore };
    }

    if (!createDto.scorecardTemplateId) {
      throw new BadRequestException('scorecardId with recordingId, or scorecardTemplateId is required');
    }
    return this.prisma.evaluation.create({
      data: {
        recordingId: createDto.recordingId,
        chatId: createDto.chatId,
        scorecardTemplateId: createDto.scorecardTemplateId,
        evaluatorId,
        agentId,
        teamCode,
        responses: (createDto.responses as object[]) || [],
        status: 'DRAFT',
      },
      include: {
        scorecardTemplate: true,
        evaluator: { select: { fullName: true } },
      },
    });
  }

  async findAll(access: AccessControl, page = 1, pageSize = 20) {
    const where: Record<string, unknown> = {};

    if (access.role === 'USER' && access.agentId) {
      const agent = await this.prisma.agent.findFirst({
        where: { agentId: access.agentId },
      });
      if (agent) where.agentId = agent.id;
      else where.agentId = '__none__';
    } else if (access.role === 'SUPERVISOR' && access.teamCodes?.length) {
      where.teamCode = { in: access.teamCodes };
    }

    const [data, total] = await Promise.all([
      this.prisma.evaluation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          recording: { select: { id: true, startTime: true, durationSeconds: true } },
          scorecardTemplate: { select: { id: true, name: true } },
          scorecard: { select: { id: true, name: true } },
          evaluator: { select: { fullName: true } },
          agent: { select: { agentId: true, fullName: true } },
        },
      }),
      this.prisma.evaluation.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string, access: AccessControl) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id },
      include: {
        recording: true,
        scorecardTemplate: true,
        scorecard: { include: { sections: { include: { questions: true } } } },
        evaluator: { select: { fullName: true } },
        agent: { select: { agentId: true, fullName: true } },
        answers: { include: { question: true } },
        bookmarks: true,
      },
    });

    if (!evaluation) throw new NotFoundException('Evaluation not found');

    if (access.role === 'USER') {
      const agent = await this.prisma.agent.findFirst({
        where: { agentId: access.agentId },
      });
      if (!agent || evaluation.agentId !== agent.id) {
        throw new ForbiddenException('Access denied');
      }
    } else if (access.role === 'SUPERVISOR' && access.teamCodes?.length) {
      if (!access.teamCodes.includes(evaluation.teamCode)) {
        throw new ForbiddenException('Access denied');
      }
    }

    return evaluation;
  }

  async update(
    id: string,
    data: { answers?: Array<{ questionId: string; value?: string; score?: number; comment?: string }>; comments?: string },
    evaluatorId: string,
  ) {
    const evaluation = await this.prisma.evaluation.findUnique({ where: { id } });
    if (!evaluation) throw new NotFoundException('Evaluation not found');
    if (evaluation.evaluatorId !== evaluatorId) throw new ForbiddenException('Can only edit your own evaluations');
    if (evaluation.status !== 'DRAFT') throw new BadRequestException('Can only edit DRAFT evaluations');

    if (data.answers && evaluation.scorecardId) {
      for (const a of data.answers) {
        await this.prisma.evaluationAnswer.upsert({
          where: {
            evaluationId_questionId: { evaluationId: id, questionId: a.questionId },
          },
          create: { evaluationId: id, questionId: a.questionId, value: a.value, score: a.score, comment: a.comment },
          update: { value: a.value, score: a.score, comment: a.comment },
        });
      }
    }

    const finalScore = evaluation.scorecardId ? await this.calculateEvaluationScore(id) : undefined;
    return this.prisma.evaluation.update({
      where: { id },
      data: {
        ...(data.comments !== undefined && { comments: data.comments }),
        ...(finalScore !== undefined && { finalScore }),
      },
      include: {
        scorecard: { include: { sections: { include: { questions: true } } } },
        answers: { include: { question: true } },
      },
    });
  }

  async submit(evaluationId: string, evaluatorId: string) {
    const evaluation = await this.prisma.evaluation.findUnique({ where: { id: evaluationId } });
    if (!evaluation) throw new NotFoundException('Evaluation not found');
    if (evaluation.evaluatorId !== evaluatorId) throw new ForbiddenException('Can only submit your own evaluations');
    if (evaluation.status !== 'DRAFT') throw new BadRequestException('Evaluation already submitted');

    const finalScore = evaluation.scorecardId ? await this.calculateEvaluationScore(evaluationId) : evaluation.totalScore ?? 0;
    const updated = await this.prisma.evaluation.update({
      where: { id: evaluationId },
      data: { status: 'SUBMITTED', submittedAt: new Date(), finalScore },
      include: { scorecard: true, recording: true, agent: true },
    });

    this.openSearchService.indexEvaluation({
      evaluationId,
      recordingId: evaluation.recordingId ?? undefined,
      agentId: updated.agent?.agentId ?? undefined,
      score: finalScore,
      date: new Date().toISOString().slice(0, 10),
    }).catch((err) => this.logger.warn('OpenSearch evaluation index failed', err?.message));

    return updated;
  }

  async acknowledge(evaluationId: string, userId: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: { agent: true },
    });
    if (!evaluation) throw new NotFoundException('Evaluation not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { agentId: true },
    });
    if (!user?.agentId || user.agentId !== evaluation.agent.agentId) {
      throw new ForbiddenException('Only the evaluated agent can acknowledge');
    }

    return this.prisma.evaluation.update({
      where: { id: evaluationId },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
    });
  }

  async dispute(evaluationId: string, userId: string, comment: string) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: { agent: true },
    });
    if (!evaluation) throw new NotFoundException('Evaluation not found');

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { agentId: true } });
    if (!user?.agentId || user.agentId !== evaluation.agent.agentId) {
      throw new ForbiddenException('Only the evaluated agent can dispute');
    }

    await this.prisma.dispute.create({
      data: { evaluationId, userId, comment },
    });

    return this.prisma.evaluation.update({
      where: { id: evaluationId },
      data: { status: 'DISPUTED' },
    });
  }

  async getAgentEvaluations(agentId: string, page: number, pageSize: number) {
    const agent = await this.prisma.agent.findFirst({ where: { agentId } });
    if (!agent) return { data: [], total: 0, page, pageSize, totalPages: 0 };

    const total = await this.prisma.evaluation.count({ where: { agentId: agent.id } });
    const data = await this.prisma.evaluation.findMany({
      where: { agentId: agent.id },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        recording: { select: { callId: true, startTime: true } },
        scorecardTemplate: { select: { id: true, name: true } },
        scorecard: { select: { id: true, name: true } },
        evaluator: { select: { fullName: true } },
      },
    });

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getRecordingEvaluations(recordingId: string, access: AccessControl) {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
    });
    if (!recording) throw new NotFoundException('Recording not found');

    if (access.role === 'USER' && access.agentId) {
      const agent = await this.prisma.agent.findFirst({ where: { agentId: access.agentId } });
      if (!agent || recording.agentId !== agent.id) {
        throw new ForbiddenException('Access denied');
      }
    } else if (access.role === 'SUPERVISOR' && access.teamCodes?.length) {
      if (!access.teamCodes.includes(recording.teamCode ?? '')) {
        throw new ForbiddenException('Access denied');
      }
    }

    return this.prisma.evaluation.findMany({
      where: { recordingId },
      include: {
        scorecardTemplate: { select: { name: true } },
        scorecard: { select: { name: true } },
        evaluator: { select: { fullName: true } },
        answers: { include: { question: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(access: AccessControl, dateFrom?: Date, dateTo?: Date) {
    const where: Record<string, unknown> = {};
    if (dateFrom) where.createdAt = { ...(where.createdAt as object), gte: dateFrom };
    if (dateTo) where.createdAt = { ...(where.createdAt as object), lte: dateTo };

    if (access.role === 'USER' && access.agentId) {
      const agent = await this.prisma.agent.findFirst({ where: { agentId: access.agentId } });
      if (agent) where.agentId = agent.id;
      else return { byAgent: [], byTeam: [], byDate: [] };
    } else if (access.role === 'SUPERVISOR' && access.teamCodes?.length) {
      where.teamCode = { in: access.teamCodes };
    }

    const evaluations = await this.prisma.evaluation.findMany({
      where: { ...where, status: { in: ['SUBMITTED', 'ACKNOWLEDGED', 'APPROVED'] } },
      select: {
        finalScore: true,
        totalScore: true,
        agentId: true,
        teamCode: true,
        createdAt: true,
        agent: { select: { agentId: true, fullName: true } },
        team: { select: { teamCode: true, displayName: true } },
      },
    });

    const byAgent = Object.entries(
      evaluations.reduce<Record<string, { sum: number; count: number; name: string }>>((acc, e) => {
        const key = e.agentId;
        const name = e.agent?.fullName || e.agentId;
        const score = e.finalScore ?? e.totalScore ?? 0;
        if (!acc[key]) acc[key] = { sum: 0, count: 0, name };
        acc[key].sum += score;
        acc[key].count += 1;
        return acc;
      }, {}),
    ).map(([agentId, v]) => ({
      agentId,
      agentName: v.name,
      avgScore: v.count > 0 ? v.sum / v.count : 0,
      count: v.count,
    }));

    const byTeam = Object.entries(
      evaluations.reduce<Record<string, { sum: number; count: number; name: string }>>((acc, e) => {
        const key = e.teamCode || 'unknown';
        const name = e.team?.displayName || key;
        const score = e.finalScore ?? e.totalScore ?? 0;
        if (!acc[key]) acc[key] = { sum: 0, count: 0, name };
        acc[key].sum += score;
        acc[key].count += 1;
        return acc;
      }, {}),
    ).map(([teamCode, v]) => ({
      teamCode,
      teamName: v.name,
      avgScore: v.count > 0 ? v.sum / v.count : 0,
      count: v.count,
    }));

    const byDate = Object.entries(
      evaluations.reduce<Record<string, { sum: number; count: number }>>((acc, e) => {
        const key = e.createdAt.toISOString().slice(0, 10);
        const score = e.finalScore ?? e.totalScore ?? 0;
        if (!acc[key]) acc[key] = { sum: 0, count: 0 };
        acc[key].sum += score;
        acc[key].count += 1;
        return acc;
      }, {}),
    ).map(([date, v]) => ({
      date,
      avgScore: v.count > 0 ? v.sum / v.count : 0,
      count: v.count,
    }));

    return { byAgent, byTeam, byDate };
  }
}
