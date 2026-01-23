import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  async getHealth() {
    const checks: Record<string, { status: string; message?: string }> = {};

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'OK' };
    } catch (error) {
      checks.database = { 
        status: 'DOWN', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }

    const allOk = Object.values(checks).every(c => c.status === 'OK');

    return {
      status: allOk ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks,
    };
  }

  @Get('live')
  @Public()
  getLiveness() {
    return { status: 'OK', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @Public()
  async getReadiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'OK', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'NOT_READY', timestamp: new Date().toISOString() };
    }
  }
}
