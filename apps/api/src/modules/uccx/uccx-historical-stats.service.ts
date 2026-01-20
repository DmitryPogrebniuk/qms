import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import https from 'https';

interface UCCXNode {
  host: string;
  port: number;
  url: string;
}

/**
 * Imports daily aggregated statistics from UCCX
 * Supports High Availability (HA) with automatic failover
 */
@Injectable()
export class UCCXHistoricalStatsService {
  private readonly logger = new Logger('UCCXHistoricalStatsService');
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });
  private readonly uccxNodes: UCCXNode[];
  private currentNodeIndex = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {
    this.uccxNodes = this.parseUCCXNodes();
    this.logger.log(`Initialized with ${this.uccxNodes.length} UCCX node(s)`);
  }

  private parseUCCXNodes(): UCCXNode[] {
    const nodesConfig = this.configService.get<string>('UCCX_NODES');
    if (!nodesConfig) {
      throw new Error('UCCX_NODES configuration is required');
    }

    return nodesConfig.split(',').map(node => {
      const trimmed = node.trim();
      const [host, portStr] = trimmed.includes(':') ? trimmed.split(':') : [trimmed, '8443'];
      const port = parseInt(portStr, 10);
      
      return {
        host,
        port,
        url: `https://${host}:${port}`,
      };
    });
  }

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
   * Make authenticated request to UCCX with HA failover
   */
  private async _fetchFromUCCX(endpoint: string): Promise<any[]> {
    const username = this.configService.get<string>('UCCX_USERNAME');
    const password = this.configService.get<string>('UCCX_PASSWORD');
    const timeout = this.configService.get<number>('UCCX_TIMEOUT_MS', 30000);
    const maxRetries = this.configService.get<number>('UCCX_RETRY_ATTEMPTS', 2);

    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    for (let attempt = 0; attempt < this.uccxNodes.length * maxRetries; attempt++) {
      const node = this.uccxNodes[this.currentNodeIndex];
      const url = `${node.url}${endpoint}`;

      try {
        this.logger.debug(`Attempting UCCX request to ${node.url}${endpoint}`);
        
        const response = await this.httpService.axiosRef.get(url, {
          headers: {
            Authorization: `Basic ${auth}`,
          },
          httpsAgent: this.httpsAgent,
          timeout,
        });

        this.logger.debug(`Successfully fetched from UCCX node: ${node.host}`);
        return response.data || [];

      } catch (error) {
        this.logger.warn(`UCCX node ${node.host} failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        this.currentNodeIndex = (this.currentNodeIndex + 1) % this.uccxNodes.length;

        if (attempt === (this.uccxNodes.length * maxRetries) - 1) {
          throw new Error(`UCCX HA cluster unavailable: All ${this.uccxNodes.length} nodes failed`);
        }

        await this.sleep(Math.min(1000 * Math.pow(2, attempt), 10000));
      }
    }

    throw new Error('UCCX request failed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
