import { Controller, Post, Get, Patch, Param, Body, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CoachingService } from './coaching.service';
import { RequireRoles } from '@/common/decorators/roles.decorator';
import { Role } from '@/types/shared';

@ApiTags('Coaching')
@ApiBearerAuth()
@Controller('coaching')
export class CoachingController {
  constructor(private readonly coachingService: CoachingService) {}

  @Post('evaluations/:evaluationId/plans')
  @RequireRoles(Role.SUPERVISOR, Role.ADMIN)
  @ApiOperation({ summary: 'Create coaching plan from evaluation' })
  async createPlan(@Param('evaluationId') evaluationId: string, @Body() createDto: any, @Request() req: any) {
    return this.coachingService.createCoachingPlan(evaluationId, createDto, req.user.sub);
  }

  @Get('agents/:agentId')
  @ApiOperation({ summary: 'Get agent coaching plans' })
  async getAgentPlans(
    @Param('agentId') agentId: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
  ) {
    return this.coachingService.getAgentCoachingPlans(
      agentId,
      parseInt(page) || 1,
      parseInt(pageSize) || 20,
    );
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update coaching plan status' })
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.coachingService.updateCoachingPlanStatus(id, status);
  }
}
