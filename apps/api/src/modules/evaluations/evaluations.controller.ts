import { Controller, Get, Post, Put, Param, Body, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EvaluationsService } from './evaluations.service';
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
  async create(@Body() createDto: any, @Request() req: any) {
    return this.evaluationsService.createEvaluation(
      createDto,
      req.user.sub,
      req.user.roles[0],
    );
  }

  @Put(':id/submit')
  @ApiOperation({ summary: 'Submit evaluation' })
  async submit(@Param('id') id: string, @Request() req: any) {
    return this.evaluationsService.submitEvaluation(id, req.user.sub);
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
}
