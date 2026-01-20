import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import https from 'https';

/**
 * Imports daily aggregated statistics from UCCX
 */
@Injectable()
export class UCCXHistoricalStatsService {
  private readonly logger = new Logger('UCCXHistoricalStatsService');
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Import daily stats (run nightly after call center closes)
   */
  @Cron('0 3 * * *') // 3 AM daily
  async importDailyStats(): Promise<void> {
    this.logger.log('Importing daily stats from UCCX...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      await this._importAgentDailyStats(yesterday);
      await this._importTeamDailyStats(yesterday);

      this.logger.log('Daily stats import completed');
    } catch (error) {
      this.logger.error('Daily stats import failed:', error);
    }
  }

  /**
   * Import agent daily stats
   */
  private async _importAgentDailyStats(date: Date): Promise<void> {
    try {
      const stats = await this._fetchFromUCCX(`/statistics/agent?date=${date.toISOString().split('T')[0]}`);

      for (const stat of stats) {
        const agent = await this.prisma.agent.findUnique({
          where: { agentId: stat.agentId },
        });

        if (agent) {
          await this.prisma.dailyAgentStats.upsert({
            where: { agentId_date: { agentId: agent.id, date } },
            update: {
              callsHandled: stat.callsHandled,
              avgHandleTime: stat.avgHandleTime,
              holdTime: stat.holdTime,
              transfers: stat.transfers,
              wrapUpCounts: stat.wrapUpCounts,
              updatedAt: new Date(),
            },
            create: {
              agentId: agent.id,
              date,
              callsHandled: stat.callsHandled,
              avgHandleTime: stat.avgHandleTime,
              holdTime: stat.holdTime,
              transfers: stat.transfers,
              wrapUpCounts: stat.wrapUpCounts,
            },
          });
        }
      }

      this.logger.debug(`Imported ${stats.length} agent daily stats`);
    } catch (error) {
      this.logger.error('Agent daily stats import error:', error);
    }
  }

  /**
   * Import team daily stats
   */
  private async _importTeamDailyStats(date: Date): Promise<void> {
    try {
      const stats = await this._fetchFromUCCX(`/statistics/team?date=${date.toISOString().split('T')[0]}`);

      for (const stat of stats) {
        await this.prisma.dailyTeamStats.upsert({
          where: { teamCode_date: { teamCode: stat.teamCode, date } },
          update: {
            totalCallsHandled: stat.totalCallsHandled,
            avgHandleTime: stat.avgHandleTime,
            avgHoldTime: stat.avgHoldTime,
            totalTransfers: stat.totalTransfers,
            updatedAt: new Date(),
          },
          create: {
            teamCode: stat.teamCode,
            date,
            totalCallsHandled: stat.totalCallsHandled,
            avgHandleTime: stat.avgHandleTime,
            avgHoldTime: stat.avgHoldTime,
            totalTransfers: stat.totalTransfers,
          },
        });
      }

      this.logger.debug(`Imported ${stats.length} team daily stats`);
    } catch (error) {
      this.logger.error('Team daily stats import error:', error);
    }
  }

  /**
   * Make authenticated request to UCCX
   */
  private async _fetchFromUCCX(endpoint: string): Promise<any[]> {
    const host = this.configService.get<string>('UCCX_HOST');
    const port = this.configService.get<number>('UCCX_PORT');
    const username = this.configService.get<string>('UCCX_USERNAME');
    const password = this.configService.get<string>('UCCX_PASSWORD');

    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    try {
      const response = await this.httpService.axiosRef.get(`https://${host}:${port}${endpoint}`, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        httpsAgent: this.httpsAgent,
      });

      return response.data || [];
    } catch (error) {
      this.logger.error(`UCCX fetch error for ${endpoint}:`, error);
      throw error;
    }
  }
}
