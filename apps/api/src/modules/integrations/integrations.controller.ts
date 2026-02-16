import { Controller, Get, Put, Post, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { UCCXDirectorySyncService } from '@/modules/uccx/uccx-directory-sync.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RbacGuard } from '@/common/guards/rbac.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/types/shared';

@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('integrations')
@UseGuards(JwtAuthGuard, RbacGuard)
export class IntegrationsController {
  constructor(
    private integrationsService: IntegrationsService,
    private uccxSyncService: UCCXDirectorySyncService,
  ) {}

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
    // Debug: log incoming payload
    console.log(`[DEBUG] Received integration config for type=${type}:`, settings);
    const result = await this.integrationsService.updateIntegration(type, settings);
    // Debug: log DB result
    console.log(`[DEBUG] Saved integration config for type=${type}:`, result);
    return result;
  }

  @Post('uccx/sync')
  @ApiOperation({ summary: 'Trigger UCCX directory sync (agents, teams, queues)' })
  @Roles(Role.ADMIN)
  async syncUccx() {
    const uccxConfig = await this.integrationsService.getIntegration('uccx');
    const config = uccxConfig?.settings
      ? {
          host: uccxConfig.settings.host,
          port: uccxConfig.settings.port || 8443,
          username: uccxConfig.settings.username,
          password: uccxConfig.settings.password,
        }
      : undefined;
    const result = await this.uccxSyncService.syncNow(config);
    return result;
  }

  @Post(':type/test')
  @ApiOperation({ summary: 'Test integration connection' })
  @Roles(Role.ADMIN)
  async testIntegration(@Param('type') type: string) {
    return this.integrationsService.testConnection(type)
  }
}
