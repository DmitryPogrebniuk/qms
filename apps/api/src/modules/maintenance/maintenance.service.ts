import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Types
export interface ComponentMetrics {
  cpuUsage?: number;
  memoryUsageBytes?: number;
  memoryUsagePercent?: number;
  diskUsageBytes?: number;
  diskUsagePercent?: number;
  uptimeSeconds?: number;
  requestsPerMinute?: number;
  errorRate?: number;
  avgLatencyMs?: number;
  activeConnections?: number;
  queueSize?: number;
  queueLag?: number;
  customMetrics?: Record<string, number>;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  source?: string;
  metadata?: Record<string, any>;
}

export interface LogFilter {
  levels?: string[];
  search?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  cursor?: string;
}

export interface LogResult {
  entries: LogEntry[];
  nextCursor?: string;
  totalCount?: number;
}

export interface HealthCheckResult {
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'UNKNOWN' | 'SKIPPED';
  value?: number;
  message: string;
  duration: number;
  details?: Record<string, any>;
}

export interface RestartResult {
  success: boolean;
  message: string;
  previousState: string;
  newState: string;
  durationMs: number;
}

export interface DiagnosticsBundle {
  filename: string;
  path: string;
  size: number;
  generatedAt: Date;
  components: string[];
  includesLogs: boolean;
  includesMetrics: boolean;
  includesConfig: boolean;
}

// Patterns for masking secrets in logs
const SECRET_PATTERNS = [
  { pattern: /(password|passwd|pwd)[=:]\s*["']?[\w\-!@#$%^&*]+["']?/gi, replacement: '$1=***MASKED***' },
  { pattern: /(api[_-]?key|apikey)[=:]\s*["']?[\w\-]+["']?/gi, replacement: '$1=***MASKED***' },
  { pattern: /(token|auth[_-]?token|bearer)[=:]\s*["']?[\w\-\.]+["']?/gi, replacement: '$1=***MASKED***' },
  { pattern: /(secret|client[_-]?secret)[=:]\s*["']?[\w\-]+["']?/gi, replacement: '$1=***MASKED***' },
  { pattern: /Authorization:\s*(Bearer|Basic)\s+[\w\-\.]+/gi, replacement: 'Authorization: ***MASKED***' },
];

@Injectable()
export class MaintenanceService implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceService.name);
  private componentHealthCache: Map<string, { status: string; checkedAt: Date }> = new Map();
  private isCollectorRunning = false;
  private collectorInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initializeDefaultComponents();
    this.startHealthCollector();
  }

  // ============================================
  // Component Management
  // ============================================

  async getAllComponents(includeDisabled = false) {
    const where = includeDisabled ? {} : { isEnabled: true };
    
    const components = await this.prisma.systemComponent.findMany({
      where,
      include: {
        healthChecks: {
          where: { isEnabled: true },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: {
            actions: { where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
            alerts: { where: { isActive: true } },
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return components.map(c => ({
      ...c,
      activeAlertCount: c._count.alerts,
      recentActionCount: c._count.actions,
    }));
  }

  async getComponentById(id: string) {
    const component = await this.prisma.systemComponent.findUnique({
      where: { id },
      include: {
        healthChecks: true,
        actions: {
          orderBy: { requestedAt: 'desc' },
          take: 20,
        },
        alerts: {
          where: { isActive: true },
          orderBy: { triggeredAt: 'desc' },
        },
      },
    });

    if (!component) {
      throw new NotFoundException(`Component ${id} not found`);
    }

    return component;
  }

  async getComponentByCode(code: string) {
    const component = await this.prisma.systemComponent.findUnique({
      where: { code },
      include: {
        healthChecks: true,
      },
    });

    if (!component) {
      throw new NotFoundException(`Component ${code} not found`);
    }

    return component;
  }

  async updateComponentStatus(
    code: string,
    status: 'OK' | 'DEGRADED' | 'DOWN' | 'UNKNOWN' | 'RESTARTING',
    reason?: string,
    metrics?: ComponentMetrics,
  ) {
    const component = await this.prisma.systemComponent.upsert({
      where: { code },
      update: {
        status,
        statusReason: reason,
        lastHeartbeat: new Date(),
        metrics: metrics ? (metrics as any) : undefined,
      },
      create: {
        code,
        name: code,
        componentType: 'BACKEND',
        status,
        statusReason: reason,
        lastHeartbeat: new Date(),
        metrics: metrics ? (metrics as any) : undefined,
      },
    });

    // Check if status changed and create alert if needed
    const previousStatus = this.componentHealthCache.get(code)?.status;
    if (previousStatus && previousStatus !== status) {
      await this.handleStatusChange(component, previousStatus, status);
    }

    this.componentHealthCache.set(code, { status, checkedAt: new Date() });

    return component;
  }

  // ============================================
  // Health Check Operations
  // ============================================

  async runHealthCheck(componentId: string, healthCheckId?: string) {
    const component = await this.getComponentById(componentId);
    
    const checks = healthCheckId
      ? component.healthChecks.filter(h => h.id === healthCheckId)
      : component.healthChecks.filter(h => h.isEnabled);

    const results: Array<{ checkId: string; name: string; result: HealthCheckResult }> = [];

    for (const check of checks) {
      const startTime = Date.now();
      let result: HealthCheckResult;

      try {
        result = await this.executeHealthCheck(component, check);
      } catch (error) {
        result = {
          status: 'UNKNOWN',
          message: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        };
      }

      // Update check record
      await this.prisma.healthCheck.update({
        where: { id: check.id },
        data: {
          lastStatus: result.status,
          lastValue: result.value,
          lastMessage: result.message,
          lastCheckedAt: new Date(),
        },
      });

      results.push({ checkId: check.id, name: check.name, result });
    }

    // Update component's lastHealthCheck timestamp
    await this.prisma.systemComponent.update({
      where: { id: componentId },
      data: { lastHealthCheck: new Date() },
    });

    // Determine overall status from health checks
    const overallStatus = this.determineOverallStatus(results.map(r => r.result.status));
    await this.updateComponentStatus(component.code, overallStatus);

    return { componentId, results, overallStatus };
  }

  private async executeHealthCheck(component: any, check: any): Promise<HealthCheckResult> {
    const config = check.config as Record<string, any> || {};
    const startTime = Date.now();

    switch (check.checkType) {
      case 'HTTP_PING': {
        const url = config.url || `http://localhost:${config.port || 3000}/health`;
        try {
          const response = await fetch(url, { 
            method: 'GET',
            signal: AbortSignal.timeout(check.timeoutSeconds * 1000),
          });
          const duration = Date.now() - startTime;
          
          if (response.ok) {
            return {
              status: duration > (check.criticalThreshold || 5000) ? 'CRITICAL' 
                    : duration > (check.warningThreshold || 1000) ? 'WARNING' : 'OK',
              value: duration,
              message: `HTTP ${response.status} in ${duration}ms`,
              duration,
            };
          } else {
            return { status: 'CRITICAL', message: `HTTP ${response.status}`, duration };
          }
        } catch (error) {
          return {
            status: 'CRITICAL',
            message: error instanceof Error ? error.message : 'Connection failed',
            duration: Date.now() - startTime,
          };
        }
      }

      case 'TCP_CONNECT': {
        const host = config.host || 'localhost';
        const port = config.port;
        if (!port) {
          return { status: 'UNKNOWN', message: 'No port configured', duration: 0 };
        }

        try {
          const { stdout } = await execAsync(`nc -z -w ${check.timeoutSeconds} ${host} ${port}`);
          return { status: 'OK', message: `Port ${port} is open`, duration: Date.now() - startTime };
        } catch {
          return { status: 'CRITICAL', message: `Port ${port} is closed`, duration: Date.now() - startTime };
        }
      }

      case 'DB_QUERY': {
        try {
          const result = await this.prisma.$queryRaw`SELECT 1 as test`;
          return { status: 'OK', message: 'Database responding', duration: Date.now() - startTime };
        } catch (error) {
          return {
            status: 'CRITICAL',
            message: error instanceof Error ? error.message : 'DB query failed',
            duration: Date.now() - startTime,
          };
        }
      }

      case 'DISK_SPACE': {
        try {
          const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'");
          const usagePercent = parseInt(stdout.trim(), 10);
          return {
            status: usagePercent >= (check.criticalThreshold || 90) ? 'CRITICAL'
                  : usagePercent >= (check.warningThreshold || 80) ? 'WARNING' : 'OK',
            value: usagePercent,
            message: `Disk usage: ${usagePercent}%`,
            duration: Date.now() - startTime,
          };
        } catch (error) {
          return { status: 'UNKNOWN', message: 'Cannot read disk usage', duration: Date.now() - startTime };
        }
      }

      case 'MEMORY_USAGE': {
        const freeMemory = os.freemem();
        const totalMemory = os.totalmem();
        const usedPercent = Math.round(((totalMemory - freeMemory) / totalMemory) * 100);
        return {
          status: usedPercent >= (check.criticalThreshold || 95) ? 'CRITICAL'
                : usedPercent >= (check.warningThreshold || 85) ? 'WARNING' : 'OK',
          value: usedPercent,
          message: `Memory usage: ${usedPercent}%`,
          duration: Date.now() - startTime,
        };
      }

      default:
        return { status: 'SKIPPED', message: `Check type ${check.checkType} not implemented`, duration: 0 };
    }
  }

  private determineOverallStatus(statuses: string[]): 'OK' | 'DEGRADED' | 'DOWN' | 'UNKNOWN' {
    if (statuses.includes('CRITICAL')) return 'DOWN';
    if (statuses.includes('WARNING')) return 'DEGRADED';
    if (statuses.includes('UNKNOWN')) return 'UNKNOWN';
    return 'OK';
  }

  // ============================================
  // Restart Operations
  // ============================================

  async restartComponent(
    componentId: string,
    actorId: string,
    actorName: string,
    reason?: string,
  ): Promise<RestartResult> {
    const component = await this.getComponentById(componentId);

    if (!component.isRestartable) {
      throw new ForbiddenException(`Component ${component.name} is not restartable`);
    }

    if (component.status === 'RESTARTING') {
      throw new BadRequestException(`Component ${component.name} is already restarting`);
    }

    const previousState = component.status;

    // Create action record
    const action = await this.prisma.maintenanceAction.create({
      data: {
        componentId,
        actionType: 'RESTART',
        actorId,
        actorName,
        reason,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    // Update component status
    await this.prisma.systemComponent.update({
      where: { id: componentId },
      data: { status: 'RESTARTING', statusReason: `Restarted by ${actorName}: ${reason || 'No reason'}` },
    });

    const startTime = Date.now();
    let result: RestartResult;

    try {
      result = await this.executeRestart(component);

      await this.prisma.maintenanceAction.update({
        where: { id: action.id },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          finishedAt: new Date(),
          resultMessage: result.message,
          resultDetails: result as any,
        },
      });
    } catch (error) {
      result = {
        success: false,
        message: error instanceof Error ? error.message : 'Restart failed',
        previousState,
        newState: 'UNKNOWN',
        durationMs: Date.now() - startTime,
      };

      await this.prisma.maintenanceAction.update({
        where: { id: action.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          resultMessage: result.message,
        },
      });
    }

    // Re-check health after restart
    setTimeout(() => this.runHealthCheck(componentId), 5000);

    return result;
  }

  private async executeRestart(component: any): Promise<RestartResult> {
    const previousState = component.status;
    const startTime = Date.now();
    const config = component.restartConfig as Record<string, any> || {};

    switch (component.restartMethod) {
      case 'DOCKER': {
        const containerName = config.containerName || component.code;
        try {
          await execAsync(`docker restart ${containerName}`);
          return {
            success: true,
            message: `Docker container ${containerName} restarted`,
            previousState,
            newState: 'UNKNOWN',
            durationMs: Date.now() - startTime,
          };
        } catch (error) {
          throw new Error(`Docker restart failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }

      case 'KUBERNETES': {
        const namespace = config.namespace || 'default';
        const deployment = config.deployment || component.code;
        try {
          await execAsync(`kubectl rollout restart deployment/${deployment} -n ${namespace}`);
          return {
            success: true,
            message: `Kubernetes deployment ${deployment} restarted`,
            previousState,
            newState: 'UNKNOWN',
            durationMs: Date.now() - startTime,
          };
        } catch (error) {
          throw new Error(`Kubernetes restart failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }

      case 'SYSTEMD': {
        const serviceName = config.serviceName || component.code;
        try {
          await execAsync(`sudo systemctl restart ${serviceName}`);
          return {
            success: true,
            message: `Systemd service ${serviceName} restarted`,
            previousState,
            newState: 'UNKNOWN',
            durationMs: Date.now() - startTime,
          };
        } catch (error) {
          throw new Error(`Systemd restart failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }

      case 'INTERNAL': {
        // For internal restarts (like reconnecting to external services)
        return {
          success: true,
          message: 'Internal restart triggered',
          previousState,
          newState: 'OK',
          durationMs: Date.now() - startTime,
        };
      }

      case 'NONE':
      default:
        throw new BadRequestException(`Restart method ${component.restartMethod} not supported`);
    }
  }

  // ============================================
  // Log Operations
  // ============================================

  async getComponentLogs(componentCode: string, filter: LogFilter): Promise<LogResult> {
    const component = await this.getComponentByCode(componentCode);
    const config = component.restartConfig as Record<string, any> || {};

    let entries: LogEntry[] = [];

    // Try to get logs based on restart method (which indicates how the component is deployed)
    switch (component.restartMethod) {
      case 'DOCKER': {
        const containerName = config.containerName || componentCode;
        entries = await this.getDockerLogs(containerName, filter);
        break;
      }

      case 'KUBERNETES': {
        const namespace = config.namespace || 'default';
        const deployment = config.deployment || componentCode;
        entries = await this.getKubernetesLogs(namespace, deployment, filter);
        break;
      }

      case 'SYSTEMD': {
        const serviceName = config.serviceName || componentCode;
        entries = await this.getSystemdLogs(serviceName, filter);
        break;
      }

      default: {
        // Try to read from log file if configured
        const logPath = config.logPath;
        if (logPath) {
          entries = await this.getFileLogs(logPath, filter);
        }
      }
    }

    // Mask secrets in log entries
    entries = entries.map(e => ({
      ...e,
      message: this.maskSecrets(e.message),
    }));

    // Apply search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      entries = entries.filter(e => 
        e.message.toLowerCase().includes(searchLower) ||
        e.source?.toLowerCase().includes(searchLower)
      );
    }

    // Apply level filter
    if (filter.levels && filter.levels.length > 0) {
      entries = entries.filter(e => filter.levels!.includes(e.level));
    }

    const limit = filter.limit || 100;
    const limitedEntries = entries.slice(0, limit);
    const nextCursor = entries.length > limit ? entries[limit - 1]?.id : undefined;

    return {
      entries: limitedEntries,
      nextCursor,
      totalCount: entries.length,
    };
  }

  private async getDockerLogs(containerName: string, filter: LogFilter): Promise<LogEntry[]> {
    try {
      const since = filter.startTime ? `--since ${filter.startTime.toISOString()}` : '--since 1h';
      const until = filter.endTime ? `--until ${filter.endTime.toISOString()}` : '';
      const tail = filter.limit ? `--tail ${filter.limit}` : '--tail 500';

      const { stdout } = await execAsync(
        `docker logs ${containerName} ${since} ${until} ${tail} 2>&1`
      );

      return this.parseLogOutput(stdout, containerName);
    } catch (error) {
      this.logger.warn(`Failed to get Docker logs for ${containerName}: ${error}`);
      return [];
    }
  }

  private async getKubernetesLogs(namespace: string, deployment: string, filter: LogFilter): Promise<LogEntry[]> {
    try {
      const since = filter.startTime ? `--since-time=${filter.startTime.toISOString()}` : '--since=1h';
      const tail = filter.limit ? `--tail=${filter.limit}` : '--tail=500';

      const { stdout } = await execAsync(
        `kubectl logs deployment/${deployment} -n ${namespace} ${since} ${tail} 2>&1`
      );

      return this.parseLogOutput(stdout, deployment);
    } catch (error) {
      this.logger.warn(`Failed to get Kubernetes logs for ${deployment}: ${error}`);
      return [];
    }
  }

  private async getSystemdLogs(serviceName: string, filter: LogFilter): Promise<LogEntry[]> {
    try {
      const since = filter.startTime ? `--since "${filter.startTime.toISOString()}"` : '--since "1 hour ago"';
      const until = filter.endTime ? `--until "${filter.endTime.toISOString()}"` : '';
      const lines = filter.limit ? `-n ${filter.limit}` : '-n 500';

      const { stdout } = await execAsync(
        `journalctl -u ${serviceName} ${since} ${until} ${lines} --no-pager -o json`
      );

      const entries: LogEntry[] = [];
      for (const line of stdout.split('\n').filter(l => l.trim())) {
        try {
          const entry = JSON.parse(line);
          entries.push({
            id: entry.__CURSOR || `${Date.now()}-${Math.random()}`,
            timestamp: new Date(parseInt(entry.__REALTIME_TIMESTAMP) / 1000),
            level: this.mapSystemdPriority(entry.PRIORITY),
            message: entry.MESSAGE,
            source: serviceName,
          });
        } catch {
          // Skip malformed lines
        }
      }

      return entries;
    } catch (error) {
      this.logger.warn(`Failed to get Systemd logs for ${serviceName}: ${error}`);
      return [];
    }
  }

  private async getFileLogs(logPath: string, filter: LogFilter): Promise<LogEntry[]> {
    try {
      const lines = filter.limit || 500;
      const { stdout } = await execAsync(`tail -n ${lines} "${logPath}"`);
      return this.parseLogOutput(stdout, path.basename(logPath));
    } catch (error) {
      this.logger.warn(`Failed to read log file ${logPath}: ${error}`);
      return [];
    }
  }

  private parseLogOutput(output: string, source: string): LogEntry[] {
    const entries: LogEntry[] = [];
    const lines = output.split('\n').filter(l => l.trim());

    for (const line of lines) {
      // Try to parse as JSON first
      try {
        const json = JSON.parse(line);
        entries.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          timestamp: new Date(json.timestamp || json.time || json.ts || Date.now()),
          level: this.normalizeLogLevel(json.level || json.severity || 'INFO'),
          message: json.message || json.msg || line,
          source,
          metadata: json,
        });
        continue;
      } catch {
        // Not JSON, try regex patterns
      }

      // Try common log format patterns
      const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*Z?)\s*(.*)$/);
      const levelMatch = line.match(/\[(DEBUG|INFO|WARN|ERROR|FATAL)\]/i);

      entries.push({
        id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        timestamp: timestampMatch ? new Date(timestampMatch[1]) : new Date(),
        level: levelMatch ? this.normalizeLogLevel(levelMatch[1]) : 'INFO',
        message: timestampMatch ? timestampMatch[2] : line,
        source,
      });
    }

    return entries;
  }

  private normalizeLogLevel(level: string): 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' {
    const normalized = level.toUpperCase();
    if (['DEBUG', 'TRACE', 'VERBOSE'].includes(normalized)) return 'DEBUG';
    if (['INFO', 'LOG'].includes(normalized)) return 'INFO';
    if (['WARN', 'WARNING'].includes(normalized)) return 'WARN';
    if (['ERROR', 'ERR'].includes(normalized)) return 'ERROR';
    if (['FATAL', 'CRITICAL', 'CRIT'].includes(normalized)) return 'FATAL';
    return 'INFO';
  }

  private mapSystemdPriority(priority: string): 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL' {
    switch (parseInt(priority, 10)) {
      case 7: return 'DEBUG';
      case 6:
      case 5: return 'INFO';
      case 4: return 'WARN';
      case 3: return 'ERROR';
      case 0:
      case 1:
      case 2: return 'FATAL';
      default: return 'INFO';
    }
  }

  private maskSecrets(text: string): string {
    let masked = text;
    for (const { pattern, replacement } of SECRET_PATTERNS) {
      masked = masked.replace(pattern, replacement);
    }
    return masked;
  }

  // ============================================
  // Alert Operations
  // ============================================

  async getActiveAlerts(componentCode?: string) {
    const where: any = { isActive: true };
    if (componentCode) {
      const component = await this.getComponentByCode(componentCode);
      where.componentId = component.id;
    }

    return this.prisma.maintenanceAlert.findMany({
      where,
      include: { component: true },
      orderBy: [{ severity: 'desc' }, { triggeredAt: 'desc' }],
    });
  }

  async acknowledgeAlert(alertId: string, userId: string) {
    const alert = await this.prisma.maintenanceAlert.findUnique({ where: { id: alertId } });
    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    return this.prisma.maintenanceAlert.update({
      where: { id: alertId },
      data: {
        isAcknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });
  }

  async resolveAlert(alertId: string) {
    return this.prisma.maintenanceAlert.update({
      where: { id: alertId },
      data: {
        isActive: false,
        resolvedAt: new Date(),
      },
    });
  }

  private async handleStatusChange(component: any, previousStatus: string, newStatus: string) {
    if (newStatus === 'DOWN') {
      await this.prisma.maintenanceAlert.create({
        data: {
          componentId: component.id,
          alertType: 'COMPONENT_DOWN',
          severity: component.isCritical ? 'CRITICAL' : 'ERROR',
          title: `${component.name} is DOWN`,
          message: `Component ${component.name} changed status from ${previousStatus} to ${newStatus}. Reason: ${component.statusReason || 'Unknown'}`,
        },
      });
    } else if (newStatus === 'DEGRADED') {
      await this.prisma.maintenanceAlert.create({
        data: {
          componentId: component.id,
          alertType: 'COMPONENT_DEGRADED',
          severity: 'WARNING',
          title: `${component.name} is DEGRADED`,
          message: `Component ${component.name} performance is degraded. Reason: ${component.statusReason || 'Unknown'}`,
        },
      });
    } else if (newStatus === 'OK' && ['DOWN', 'DEGRADED'].includes(previousStatus)) {
      // Auto-resolve active alerts when component recovers
      await this.prisma.maintenanceAlert.updateMany({
        where: {
          componentId: component.id,
          isActive: true,
          alertType: { in: ['COMPONENT_DOWN', 'COMPONENT_DEGRADED'] },
        },
        data: {
          isActive: false,
          resolvedAt: new Date(),
        },
      });
    }
  }

  // ============================================
  // Action History
  // ============================================

  async getActionHistory(params: {
    componentId?: string;
    actorId?: string;
    actionType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (params.componentId) where.componentId = params.componentId;
    if (params.actorId) where.actorId = params.actorId;
    if (params.actionType) where.actionType = params.actionType;
    if (params.startDate || params.endDate) {
      where.requestedAt = {};
      if (params.startDate) where.requestedAt.gte = params.startDate;
      if (params.endDate) where.requestedAt.lte = params.endDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.maintenanceAction.findMany({
        where,
        include: { component: { select: { code: true, name: true } } },
        orderBy: { requestedAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0,
      }),
      this.prisma.maintenanceAction.count({ where }),
    ]);

    return { items, total };
  }

  // ============================================
  // Diagnostics Bundle
  // ============================================

  async generateDiagnosticsBundle(
    componentCodes: string[],
    options: { includeLogs?: boolean; includeMetrics?: boolean; includeConfig?: boolean } = {},
  ): Promise<DiagnosticsBundle> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `diagnostics-${timestamp}.json`;
    const exportDir = this.config.get('EXPORT_DIR') || '/tmp';
    const filePath = path.join(exportDir, filename);

    const bundle: any = {
      generatedAt: new Date().toISOString(),
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptime: os.uptime(),
        memory: { total: os.totalmem(), free: os.freemem() },
        cpus: os.cpus().length,
      },
      components: [],
    };

    const components = componentCodes.length > 0
      ? await this.prisma.systemComponent.findMany({ where: { code: { in: componentCodes } }, include: { healthChecks: true } })
      : await this.prisma.systemComponent.findMany({ include: { healthChecks: true } });

    for (const component of components) {
      const componentData: any = {
        code: component.code,
        name: component.name,
        type: component.componentType,
        status: component.status,
        statusReason: component.statusReason,
        lastHeartbeat: component.lastHeartbeat,
        version: component.version,
        healthChecks: component.healthChecks.map(h => ({
          name: h.name,
          type: h.checkType,
          status: h.lastStatus,
          lastChecked: h.lastCheckedAt,
          message: h.lastMessage,
        })),
      };

      if (options.includeMetrics && component.metrics) {
        componentData.metrics = component.metrics;
      }

      if (options.includeLogs) {
        try {
          const logs = await this.getComponentLogs(component.code, { limit: 100 });
          componentData.recentLogs = logs.entries;
        } catch {
          componentData.recentLogs = [];
        }
      }

      bundle.components.push(componentData);
    }

    // Write bundle to file
    await fs.writeFile(filePath, JSON.stringify(bundle, null, 2), 'utf-8');
    const stats = await fs.stat(filePath);

    return {
      filename,
      path: filePath,
      size: stats.size,
      generatedAt: new Date(),
      components: components.map(c => c.code),
      includesLogs: options.includeLogs || false,
      includesMetrics: options.includeMetrics || false,
      includesConfig: options.includeConfig || false,
    };
  }

  // ============================================
  // System Overview
  // ============================================

  async getSystemOverview() {
    const components = await this.getAllComponents();
    const activeAlerts = await this.getActiveAlerts();

    const statusCounts = {
      OK: 0,
      DEGRADED: 0,
      DOWN: 0,
      UNKNOWN: 0,
      RESTARTING: 0,
    };

    for (const component of components) {
      statusCounts[component.status as keyof typeof statusCounts]++;
    }

    const alertCounts = {
      CRITICAL: 0,
      ERROR: 0,
      WARNING: 0,
      INFO: 0,
    };

    for (const alert of activeAlerts) {
      alertCounts[alert.severity as keyof typeof alertCounts]++;
    }

    // Determine overall system health
    let overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
    if (statusCounts.DOWN > 0 || alertCounts.CRITICAL > 0) {
      overallHealth = 'CRITICAL';
    } else if (statusCounts.DEGRADED > 0 || alertCounts.ERROR > 0 || alertCounts.WARNING > 0) {
      overallHealth = 'DEGRADED';
    }

    return {
      overallHealth,
      components: {
        total: components.length,
        ...statusCounts,
      },
      alerts: {
        total: activeAlerts.length,
        ...alertCounts,
      },
      lastUpdated: new Date(),
    };
  }

  // ============================================
  // Health Collector Background Process
  // ============================================

  private startHealthCollector() {
    if (this.isCollectorRunning) return;

    const intervalSeconds = this.config.get<number>('HEALTH_CHECK_INTERVAL_SECONDS') || 60;
    
    this.collectorInterval = setInterval(async () => {
      try {
        await this.collectAllHealth();
      } catch (error) {
        this.logger.error('Health collector error:', error);
      }
    }, intervalSeconds * 1000);

    this.isCollectorRunning = true;
    this.logger.log(`Health collector started with ${intervalSeconds}s interval`);
  }

  private async collectAllHealth() {
    const components = await this.prisma.systemComponent.findMany({
      where: { isEnabled: true },
      include: { healthChecks: { where: { isEnabled: true } } },
    });

    for (const component of components) {
      if (component.healthChecks.length > 0) {
        try {
          await this.runHealthCheck(component.id);
        } catch (error) {
          this.logger.warn(`Health check failed for ${component.code}: ${error}`);
        }
      }
    }
  }

  // ============================================
  // Default Components Initialization
  // ============================================

  private async initializeDefaultComponents() {
    const defaults = [
      {
        code: 'api',
        name: 'QMS API',
        componentType: 'BACKEND' as const,
        description: 'Main backend API server',
        isCritical: true,
        restartMethod: 'DOCKER' as const,
        restartConfig: { containerName: 'qms-api' },
        displayOrder: 1,
        healthChecks: [
          { name: 'HTTP Health', checkType: 'HTTP_PING' as const, config: { url: 'http://localhost:3000/health' } },
          { name: 'Database', checkType: 'DB_QUERY' as const },
        ],
      },
      {
        code: 'web',
        name: 'QMS Web UI',
        componentType: 'FRONTEND' as const,
        description: 'React frontend application',
        isCritical: true,
        restartMethod: 'DOCKER' as const,
        restartConfig: { containerName: 'qms-web' },
        displayOrder: 2,
        healthChecks: [
          { name: 'HTTP Health', checkType: 'HTTP_PING' as const, config: { url: 'http://localhost:80' } },
        ],
      },
      {
        code: 'postgres',
        name: 'PostgreSQL',
        componentType: 'DATABASE' as const,
        description: 'Primary database',
        isCritical: true,
        isRestartable: false,
        restartMethod: 'NONE' as const,
        displayOrder: 3,
        healthChecks: [
          { name: 'Connection', checkType: 'TCP_CONNECT' as const, config: { host: 'postgres', port: 5432 } },
        ],
      },
      {
        code: 'redis',
        name: 'Redis',
        componentType: 'DATABASE' as const,
        description: 'Cache and session store',
        isCritical: false,
        isRestartable: false,
        restartMethod: 'NONE' as const,
        displayOrder: 4,
        healthChecks: [
          { name: 'Connection', checkType: 'TCP_CONNECT' as const, config: { host: 'redis', port: 6379 } },
        ],
      },
      {
        code: 'opensearch',
        name: 'OpenSearch',
        componentType: 'SEARCH' as const,
        description: 'Full-text search engine',
        isCritical: false,
        isRestartable: false,
        restartMethod: 'NONE' as const,
        displayOrder: 5,
        healthChecks: [
          { name: 'HTTP Health', checkType: 'HTTP_PING' as const, config: { url: 'http://opensearch:9200/_cluster/health' } },
        ],
      },
      {
        code: 'mediasense',
        name: 'MediaSense Integration',
        componentType: 'INTEGRATION' as const,
        description: 'Cisco MediaSense recording system',
        isCritical: false,
        restartMethod: 'INTERNAL' as const,
        displayOrder: 6,
        healthChecks: [
          { name: 'API Connection', checkType: 'HTTP_PING' as const, config: { } },
        ],
      },
      {
        code: 'uccx',
        name: 'UCCX Integration',
        componentType: 'INTEGRATION' as const,
        description: 'Cisco UCCX contact center',
        isCritical: false,
        restartMethod: 'INTERNAL' as const,
        displayOrder: 7,
        healthChecks: [
          { name: 'API Connection', checkType: 'HTTP_PING' as const, config: { } },
        ],
      },
    ];

    for (const def of defaults) {
      const { healthChecks, ...componentData } = def;

      const existing = await this.prisma.systemComponent.findUnique({
        where: { code: def.code },
      });

      if (!existing) {
        const component = await this.prisma.systemComponent.create({
          data: {
            ...componentData,
            restartConfig: componentData.restartConfig as any,
          },
        });

        for (const check of healthChecks) {
          await this.prisma.healthCheck.create({
            data: {
              componentId: component.id,
              name: check.name,
              checkType: check.checkType,
              config: check.config as any,
            },
          });
        }

        this.logger.log(`Initialized default component: ${def.code}`);
      }
    }
  }

  onModuleDestroy() {
    if (this.collectorInterval) {
      clearInterval(this.collectorInterval);
      this.isCollectorRunning = false;
    }
  }
}
