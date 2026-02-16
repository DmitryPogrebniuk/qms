import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RbacGuard } from '@/common/guards/rbac.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/types/shared';
import { AuditService } from './audit.service';

function getClientIp(req: any): string | undefined {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    const first = typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0];
    return first?.trim();
  }
  return req.ip || req.connection?.remoteAddress;
}

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, RbacGuard)
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Get audit log (read-only, immutable compliance trail)
   */
  @Get()
  @ApiOperation({ summary: 'Get audit log (Admin only, read-only)' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'resourceId', required: false, description: 'Filter by resource (e.g. recording ID)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size (max 100)' })
  async getAuditLogs(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('resourceId') resourceId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ) {
    const result = await this.auditService.getAuditLogs({
      dateFrom,
      dateTo,
      action,
      userId,
      resourceId,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });

    await this.auditService.logAuditView(req.user.sub || req.user.id, getClientIp(req));

    return result;
  }
}
