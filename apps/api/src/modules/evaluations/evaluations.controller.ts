import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { RequireRoles } from '@/common/decorators/roles.decorator';
import { Role } from '@/types/shared';

@ApiTags('Evaluations')
@ApiBearerAuth()
@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post()
  @RequireRoles(Role.QA, Role.SUPERVISOR, Role.ADMIN)
  @ApiOperation({ summary: 'Create evaluation' })
  async create(@Body() dto: CreateEvaluationDto, @Request() req: any) {
    return this.evaluationsService.createEvaluation(
      {
        recordingId: dto.recordingId,
        scorecardId: dto.scorecardId,
        scorecardTemplateId: dto.scorecardTemplateId,
        answers: dto.answers,
      },
      req.user.sub,
      req.user.role || req.user.roles?.[0] || 'USER',
    );
  }

  @Get()
  @ApiOperation({ summary: 'List evaluations' })
  async findAll(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Request() req: any,
  ) {
    const access = {
      userId: req.user.sub,
      role: req.user.role || req.user.roles?.[0] || 'USER',
      agentId: req.user.agentId,
      teamCodes: req.user.teamCodes ?? [],
    };
    return this.evaluationsService.findAll(
      access,
      parseInt(page) || 1,
      parseInt(pageSize) || 20,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Evaluation statistics' })
  async getStats(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Request() req: any,
  ) {
    const access = {
      userId: req.user.sub,
      role: req.user.role || req.user.roles?.[0] || 'USER',
      agentId: req.user.agentId,
      teamCodes: req.user.teamCodes ?? [],
    };
    return this.evaluationsService.getStats(access, dateFrom ? new Date(dateFrom) : undefined, dateTo ? new Date(dateTo) : undefined);
  }

  @Get('agent/:agentId')
  @ApiOperation({ summary: 'Get agent evaluations' })
  async getAgentEvaluations(
    @Param('agentId') agentId: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
  ) {
    return this.evaluationsService.getAgentEvaluations(
      agentId,
      parseInt(page) || 1,
      parseInt(pageSize) || 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get evaluation by ID' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const access = {
      userId: req.user.sub,
      role: req.user.role || req.user.roles?.[0] || 'USER',
      agentId: req.user.agentId,
      teamCodes: req.user.teamCodes ?? [],
    };
    return this.evaluationsService.findOne(id, access);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update evaluation (DRAFT only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEvaluationDto,
    @Request() req: any,
  ) {
    return this.evaluationsService.update(
      id,
      { answers: dto.answers, comments: dto.comments },
      req.user.sub,
    );
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit evaluation' })
  async submit(@Param('id') id: string, @Request() req: any) {
    return this.evaluationsService.submit(id, req.user.sub);
  }

  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge evaluation (agent)' })
  async acknowledge(@Param('id') id: string, @Request() req: any) {
    return this.evaluationsService.acknowledge(id, req.user.sub);
  }

  @Post(':id/dispute')
  @ApiOperation({ summary: 'Dispute evaluation (agent)' })
  async dispute(
    @Param('id') id: string,
    @Body() body: { comment: string },
    @Request() req: any,
  ) {
    return this.evaluationsService.dispute(id, req.user.sub, body.comment);
  }
}
