import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditAction } from '@prisma/client';

export interface AuditLogFilters {
  dateFrom?: string;
  dateTo?: string;
  action?: AuditAction | string;
  userId?: string;
  resourceId?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get audit log entries (read-only, immutable)
   */
  async getAuditLogs(filters: AuditLogFilters): Promise<{
    items: AuditLogEntry[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }
    if (filters.action) where.action = filters.action;
    if (filters.userId) where.userId = filters.userId;
    if (filters.resourceId) where.resourceId = filters.resourceId;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((a) => ({
        id: a.id,
        userId: a.userId,
        userName: a.user.username,
        userRole: a.userRole,
        action: a.action,
        resourceId: a.resourceId,
        metadata: a.filters as Record<string, unknown> | null,
        ipAddress: a.ipAddress,
        createdAt: a.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Log audit view (when admin views audit log - meta-audit)
   */
  async logAuditView(userId: string, ipAddress?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        userRole: user?.role || 'ADMIN',
        action: AuditAction.AUDIT_VIEW,
        ipAddress,
      },
    });
  }
}
