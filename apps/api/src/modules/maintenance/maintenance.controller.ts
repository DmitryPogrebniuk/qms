import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@/types/shared';
import { MaintenanceService, LogFilter } from './maintenance.service';
import * as fs from 'fs';

// DTOs
class RestartComponentDto {
  reason?: string;
}

class RunHealthCheckDto {
  healthCheckId?: string;
}

class GetLogsDto {
  levels?: string;
  search?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  cursor?: string;
}

class GetActionsDto {
  componentId?: string;
  actorId?: string;
  actionType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

class GenerateDiagnosticsDto {
  componentCodes?: string[];
  includeLogs?: boolean;
  includeMetrics?: boolean;
  includeConfig?: boolean;
}

class AcknowledgeAlertDto {
  // No additional fields needed
}

@Controller('maintenance')
@UseGuards(JwtAuthGuard, RbacGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  // ============================================
  // System Overview
  // ============================================

  @Get('overview')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async getSystemOverview() {
    return this.maintenanceService.getSystemOverview();
  }

  // ============================================
  // Components
  // ============================================

  @Get('components')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async getAllComponents(@Query('includeDisabled') includeDisabled?: string) {
    return this.maintenanceService.getAllComponents(includeDisabled === 'true');
  }

  @Get('components/:id')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async getComponentById(@Param('id') id: string) {
    return this.maintenanceService.getComponentById(id);
  }

  @Get('components/code/:code')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async getComponentByCode(@Param('code') code: string) {
    return this.maintenanceService.getComponentByCode(code);
  }

  @Post('components/:id/restart')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async restartComponent(
    @Param('id') id: string,
    @Body() dto: RestartComponentDto,
    @Req() req: any,
  ) {
    const user = req.user;
    return this.maintenanceService.restartComponent(
      id,
      user.sub || user.id,
      user.name || user.email || 'Unknown',
      dto.reason,
    );
  }

  // ============================================
  // Health Checks
  // ============================================

  @Post('components/:id/health/run')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async runHealthCheck(
    @Param('id') id: string,
    @Body() dto: RunHealthCheckDto,
  ) {
    return this.maintenanceService.runHealthCheck(id, dto.healthCheckId);
  }

  // ============================================
  // Logs
  // ============================================

  @Get('components/:code/logs')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async getComponentLogs(
    @Param('code') code: string,
    @Query() query: GetLogsDto,
  ) {
    const filter: LogFilter = {
      levels: query.levels ? query.levels.split(',') : undefined,
      search: query.search,
      startTime: query.startTime ? new Date(query.startTime) : undefined,
      endTime: query.endTime ? new Date(query.endTime) : undefined,
      limit: query.limit ? parseInt(String(query.limit), 10) : 100,
      cursor: query.cursor,
    };
    
    return this.maintenanceService.getComponentLogs(code, filter);
  }

  // ============================================
  // Alerts
  // ============================================

  @Get('alerts')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async getActiveAlerts(@Query('componentCode') componentCode?: string) {
    return this.maintenanceService.getActiveAlerts(componentCode);
  }

  @Patch('alerts/:id/acknowledge')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async acknowledgeAlert(
    @Param('id') id: string,
    @Body() _dto: AcknowledgeAlertDto,
    @Req() req: any,
  ) {
    const user = req.user;
    return this.maintenanceService.acknowledgeAlert(id, user.sub || user.id);
  }

  @Patch('alerts/:id/resolve')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async resolveAlert(@Param('id') id: string) {
    return this.maintenanceService.resolveAlert(id);
  }

  // ============================================
  // Action History (Audit)
  // ============================================

  @Get('actions')
  @Roles(Role.ADMIN, Role.SUPERVISOR)
  async getActionHistory(@Query() query: GetActionsDto) {
    return this.maintenanceService.getActionHistory({
      componentId: query.componentId,
      actorId: query.actorId,
      actionType: query.actionType,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit ? parseInt(String(query.limit), 10) : 50,
      offset: query.offset ? parseInt(String(query.offset), 10) : 0,
    });
  }

  // ============================================
  // Diagnostics Bundle
  // ============================================

  @Post('diagnostics')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async generateDiagnosticsBundle(@Body() dto: GenerateDiagnosticsDto) {
    return this.maintenanceService.generateDiagnosticsBundle(
      dto.componentCodes || [],
      {
        includeLogs: dto.includeLogs,
        includeMetrics: dto.includeMetrics,
        includeConfig: dto.includeConfig,
      },
    );
  }

  @Get('diagnostics/:filename')
  @Roles(Role.ADMIN)
  async downloadDiagnosticsBundle(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Security: only allow alphanumeric, dash, underscore, and .json extension
    if (!/^[\w\-]+\.json$/.test(filename)) {
      throw new Error('Invalid filename');
    }

    const exportDir = process.env.EXPORT_DIR || '/tmp';
    const filePath = `${exportDir}/${filename}`;

    const file = fs.createReadStream(filePath);
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(file);
  }

  // ============================================
  // Heartbeat (for components to report status)
  // ============================================

  @Post('heartbeat/:code')
  @HttpCode(HttpStatus.OK)
  async reportHeartbeat(
    @Param('code') code: string,
    @Body() body: {
      status: 'OK' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
      reason?: string;
      metrics?: any;
    },
  ) {
    return this.maintenanceService.updateComponentStatus(
      code,
      body.status,
      body.reason,
      body.metrics,
    );
  }
}
