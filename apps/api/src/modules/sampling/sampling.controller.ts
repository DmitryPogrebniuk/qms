import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SamplingService } from './sampling.service';
import { RequireRoles } from '@/common/decorators/roles.decorator';
import { Role } from '@/types/shared';

@ApiTags('Sampling')
@ApiBearerAuth()
@Controller('sampling')
export class SamplingController {
  constructor(private readonly samplingService: SamplingService) {}

  @Post('rules')
  @RequireRoles(Role.ADMIN)
  @ApiOperation({ summary: 'Create sampling rule' })
  async createRule(@Body() createDto: any) {
    return this.samplingService.createSamplingRule(createDto);
  }

  @Get('qa-worklist')
  @RequireRoles(Role.QA)
  @ApiOperation({ summary: 'Get QA worklist' })
  async getWorklist(
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
  ) {
    return this.samplingService.getQAWorklist(
      'current-qa-user-id',
      parseInt(page) || 1,
      parseInt(pageSize) || 20,
    );
  }

  @Patch('records/:id/evaluated')
  @ApiOperation({ summary: 'Mark sampling record as evaluated' })
  async markEvaluated(@Param('id') id: string) {
    return this.samplingService.markEvaluated(id);
  }
}
