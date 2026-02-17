import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { QuestionType } from '@prisma/client';

@Injectable()
export class ScorecardsService {
  private readonly logger = new Logger('ScorecardsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    name: string;
    description?: string;
    isActive?: boolean;
    sections?: Array<{
      name: string;
      weight?: number;
      order?: number;
      questions?: Array<{
        text: string;
        type: string;
        weight?: number;
        isCritical?: boolean;
        options?: unknown;
        order?: number;
      }>;
    }>;
  }, createdBy: string) {
    return this.prisma.scorecard.create({
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive ?? true,
        createdBy,
        sections: {
          create: (data.sections || []).map((s, si) => ({
            name: s.name,
            weight: s.weight ?? 1,
            order: s.order ?? si,
            questions: {
              create: (s.questions || []).map((q, qi) => ({
                text: q.text,
                type: (q.type || 'TEXT') as QuestionType,
                weight: q.weight ?? 1,
                isCritical: q.isCritical ?? false,
                options: q.options ? JSON.parse(JSON.stringify(q.options)) : undefined,
                order: q.order ?? qi,
              })),
            },
          })),
        },
      },
      include: {
        sections: {
          include: { questions: true },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async findAll(includeInactive = false) {
    return this.prisma.scorecard.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        sections: {
          include: { questions: true },
          orderBy: { order: 'asc' },
        },
        creator: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const scorecard = await this.prisma.scorecard.findUnique({
      where: { id },
      include: {
        sections: {
          include: { questions: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
        creator: { select: { id: true, fullName: true, username: true } },
      },
    });
    if (!scorecard) {
      throw new NotFoundException('Scorecard not found');
    }
    return scorecard;
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
      sections?: Array<{
        id?: string;
        name: string;
        weight?: number;
        order?: number;
        questions?: Array<{
          id?: string;
          text: string;
          type: string;
          weight?: number;
          isCritical?: boolean;
          options?: unknown;
          order?: number;
        }>;
      }>;
    },
  ) {
    const existing = await this.prisma.scorecard.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Scorecard not found');
    }

    if (data.sections !== undefined) {
      await this.prisma.$transaction(async (tx) => {
        await tx.scorecardQuestion.deleteMany({
          where: { section: { scorecardId: id } },
        });
        await tx.scorecardSection.deleteMany({
          where: { scorecardId: id },
        });
        for (let si = 0; si < data.sections!.length; si++) {
          const s = data.sections![si];
          await tx.scorecardSection.create({
            data: {
              scorecardId: id,
              name: s.name,
              weight: s.weight ?? 1,
              order: s.order ?? si,
              questions: {
                create: (s.questions || []).map((q, qi) => ({
                  text: q.text,
                  type: (q.type || 'TEXT') as QuestionType,
                  weight: q.weight ?? 1,
                  isCritical: q.isCritical ?? false,
                  options: q.options ? JSON.parse(JSON.stringify(q.options)) : undefined,
                  order: q.order ?? qi,
                })),
              },
            },
          });
        }
      });
    }

    return this.prisma.scorecard.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        sections: {
          include: { questions: true },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.scorecard.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Scorecard not found');
    }
    const evalCount = await this.prisma.evaluation.count({
      where: { scorecardId: id },
    });
    if (evalCount > 0) {
      throw new BadRequestException(
        `Cannot delete scorecard: ${evalCount} evaluation(s) use it. Deactivate instead.`,
      );
    }
    return this.prisma.scorecard.delete({ where: { id } });
  }
}
