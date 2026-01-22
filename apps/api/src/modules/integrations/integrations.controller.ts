import { Controller, Get, Put, Post, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RbacGuard } from '@/common/guards/rbac.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/types/shared';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('api/integrations')
@UseGuards(JwtAuthGuard, RbacGuard)
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all integration configurations' })
  @Roles(Role.ADMIN)
  async getAllIntegrations() {
    return this.integrationsService.getAllIntegrations()
  }

  @Get(':type')
  @ApiOperation({ summary: 'Get specific integration configuration' })
  @Roles(Role.ADMIN)
  async getIntegration(@Param('type') type: string) {
    return this.integrationsService.getIntegration(type)
  }

  @Put(':type')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update integration configuration' })
  @Roles(Role.ADMIN)
  async updateIntegration(@Param('type') type: string, @Body() settings: any) {
    return this.integrationsService.updateIntegration(type, settings)
  }

  @Post(':type/test')
  @ApiOperation({ summary: 'Test integration connection' })
  @Roles(Role.ADMIN)
  async testIntegration(@Param('type') type: string) {
    return this.integrationsService.testConnection(type)
  }
}
