import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class SamplingService {
  private readonly logger = new Logger('SamplingService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create sampling rule
   */
  async createSamplingRule(createDto: any) {
    return this.prisma.samplingRule.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        samplePercentage: createDto.samplePercentage,
        period: createDto.period,
        criteria: createDto.criteria,
        assignedQAs: createDto.assignedQAs,
        teamCode: createDto.teamCode,
        isActive: true,
      },
    });
  }

  /**
   * Generate samples for a rule (typically run nightly)
   */
  async generateSamples(ruleId: string) {
    const rule = await this.prisma.samplingRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule || !rule.isActive) {
      this.logger.warn(`Sampling rule ${ruleId} is not active`);
      return;
    }

    // TODO: Implement sampling algorithm
    // 1. Query recordings matching criteria
    // 2. Apply percentage-based sampling
    // 3. Create SamplingRecord entries
    // 4. Assign to QA users

    this.logger.log(`Generated samples for rule ${ruleId}`);
  }

  /**
   * Get QA worklist
   */
  async getQAWorklist(qaUserId: string, page: number, pageSize: number) {
    const total = await this.prisma.samplingRecord.count({
      where: { assignedToQA: qaUserId, evaluatedAt: null },
    });

    const data = await this.prisma.samplingRecord.findMany({
      where: { assignedToQA: qaUserId, evaluatedAt: null },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        samplingRule: true,
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
   * Mark sampling record as evaluated
   */
  async markEvaluated(recordId: string) {
    return this.prisma.samplingRecord.update({
      where: { id: recordId },
      data: { evaluatedAt: new Date() },
    });
  }
}
