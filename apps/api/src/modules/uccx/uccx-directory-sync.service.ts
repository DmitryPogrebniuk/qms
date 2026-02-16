import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import https from 'https';

/**
 * UCCX Directory Sync Service
 *
 * Syncs agents, teams, and contact service queues (CSQ) from Cisco UCCX 15
 * using the Configuration API (adminapi).
 *
 * Reference: https://developer.cisco.com/docs/contact-center-express/configuration-api-overview/
 *
 * - Resource (agents): GET /adminapi/resource
 * - Team: GET /adminapi/team
 * - CSQ (queues): GET /adminapi/csq
 *
 * Mapping identifier for recordings: extension (internal phone number)
 */

interface UCCXNode {
  host: string;
  port: number;
  url: string;
}

interface UCCXResource {
  userID?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  extension?: string;
  team?: { name?: string; refURL?: string };
  refURL?: string;
}

interface UCCXTeam {
  name?: string;
  teamCode?: string;
  refURL?: string;
}

interface UCCXCsq {
  name?: string;
  refURL?: string;
  mediaType?: string;
}

@Injectable()
export class UCCXDirectorySyncService {
  private readonly logger = new Logger('UCCXDirectorySyncService');
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });
  private uccxNodes: UCCXNode[] = [];
  private currentNodeIndex = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {
    this.initNodes();
  }

  private initNodes(): void {
    this.uccxNodes = this.parseUCCXNodes();
    if (this.uccxNodes.length > 0) {
      this.logger.log(`UCCX nodes: ${this.uccxNodes.map((n) => n.url).join(', ')}`);
    }
  }

  private parseUCCXNodes(): UCCXNode[] {
    // Prefer IntegrationSetting (DB)
    const nodesConfig =
      this.configService.get<string>('UCCX_NODES') ||
      this.configService.get<string>('UCCX_HOST');
    if (!nodesConfig) {
      return [];
    }

    return nodesConfig.split(',').map((node) => {
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

  private getAuth(): { username: string; password: string } {
    if (this.syncAuthOverride) return this.syncAuthOverride;
    return {
      username: this.configService.get<string>('UCCX_USERNAME') || '',
      password: this.configService.get<string>('UCCX_PASSWORD') || '',
    };
  }

  /**
   * Full sync: teams, agents (resources), CSQs
   * Cron: every 4 hours
   */
  @Cron('0 */4 * * *') // Every 4 hours at minute 0
  async syncFull(): Promise<void> {
    if (this.uccxNodes.length === 0) {
      this.initNodes();
    }
    if (this.uccxNodes.length === 0) {
      this.logger.debug('UCCX not configured, skipping sync');
      return;
    }

    this.logger.log('Starting full UCCX directory sync...');
    try {
      await this.prisma.syncState.upsert({
        where: { syncType: 'uccx_full' },
        update: { status: 'IN_PROGRESS' },
        create: { syncType: 'uccx_full', status: 'IN_PROGRESS' },
      });

      await this.syncTeams();
      await this.syncResources();
      await this.syncCsqs();
      await this.backfillRecordingsByExtension();

      await this.prisma.syncState.update({
        where: { syncType: 'uccx_full' },
        data: {
          status: 'SUCCESS',
          lastSyncedAt: new Date(),
          errorMessage: null,
        },
      });

      this.logger.log('Full UCCX sync completed');
    } catch (error) {
      this.logger.error('Full UCCX sync failed:', error);
      await this.prisma.syncState.update({
        where: { syncType: 'uccx_full' },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Manual sync trigger (from UI)
   * @param config Optional config from IntegrationSetting (host, port, username, password)
   */
  async syncNow(config?: {
    host: string;
    port: number;
    username: string;
    password: string;
  }): Promise<{ success: boolean; message?: string }> {
    const prevNodes = this.uccxNodes;
    const prevAuth = this.getAuth();

    if (config?.host && config?.username && config?.password) {
      this.uccxNodes = [
        {
          host: config.host,
          port: config.port || 8443,
          url: `https://${config.host}:${config.port || 8443}`,
        },
      ];
      this.syncAuthOverride = { username: config.username, password: config.password };
    }

    try {
      await this.syncFull();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed',
      };
    } finally {
      this.uccxNodes = prevNodes;
      this.syncAuthOverride = undefined;
    }
  }

  private syncAuthOverride?: { username: string; password: string };

  private async syncTeams(): Promise<void> {
    this.logger.debug('Syncing teams from UCCX adminapi/team...');
    const items = await this.fetchAdminApi<UCCXTeam>('/adminapi/team');
    if (!Array.isArray(items)) {
      this.logger.warn('UCCX team response is not an array');
      return;
    }

    for (const t of items) {
      const teamCode = t.name || t.teamCode || this.extractIdFromRef(t.refURL);
      if (!teamCode) continue;

      await this.prisma.team.upsert({
        where: { teamCode },
        update: {
          displayName: teamCode,
          lastSyncedAt: new Date(),
        },
        create: {
          teamCode,
          displayName: teamCode,
          lastSyncedAt: new Date(),
        },
      });
    }
    this.logger.debug(`Synced ${items.length} teams`);
  }

  private async syncResources(): Promise<void> {
    this.logger.debug('Syncing agents (resources) from UCCX adminapi/resource...');
    const items = await this.fetchAdminApi<UCCXResource>('/adminapi/resource');
    if (!Array.isArray(items)) {
      this.logger.warn('UCCX resource response is not an array');
      return;
    }

    for (const r of items) {
      const agentId = r.userID || r.userId || this.extractIdFromRef(r.refURL);
      if (!agentId) continue;

      const firstName = r.firstName || '';
      const lastName = r.lastName || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || agentId;
      const extension = r.extension ? String(r.extension).trim() : null;

      const teamCode = r.team?.name || (r.team?.refURL ? this.extractIdFromRef(r.team.refURL) : null);

      await this.prisma.agent.upsert({
        where: { agentId },
        update: {
          fullName,
          extension,
          lastSyncedAt: new Date(),
        },
        create: {
          agentId,
          fullName,
          extension,
          activeFlag: true,
          lastSyncedAt: new Date(),
        },
      });

      if (teamCode) {
        await this.syncAgentTeamMembership(agentId, [teamCode]);
      }
    }
    this.logger.debug(`Synced ${items.length} agents`);
  }

  private async syncAgentTeamMembership(agentId: string, teamCodes: string[]): Promise<void> {
    const agent = await this.prisma.agent.findUnique({ where: { agentId } });
    if (!agent) return;

    await this.prisma.agentTeam.deleteMany({
      where: { agentId: agent.id },
    });

    for (const code of teamCodes) {
      const team = await this.prisma.team.findUnique({ where: { teamCode: code } });
      if (team) {
        await this.prisma.agentTeam.upsert({
          where: { agentId_teamId: { agentId: agent.id, teamId: team.id } },
          update: {},
          create: { agentId: agent.id, teamId: team.id },
        });
      }
    }
  }

  private async syncCsqs(): Promise<void> {
    this.logger.debug('Syncing CSQs from UCCX adminapi/csq...');
    const items = await this.fetchAdminApi<UCCXCsq>('/adminapi/csq?detail=full');
    if (!Array.isArray(items)) {
      this.logger.warn('UCCX csq response is not an array');
      return;
    }

    for (const c of items) {
      const csqId = c.name || this.extractIdFromRef(c.refURL);
      if (!csqId) continue;

      await this.prisma.contactServiceQueue.upsert({
        where: { csqId },
        update: {
          name: c.name || csqId,
          mediaType: c.mediaType || null,
          lastSyncedAt: new Date(),
        },
        create: {
          csqId,
          name: c.name || csqId,
          mediaType: c.mediaType || null,
          lastSyncedAt: new Date(),
        },
      });
    }
    this.logger.debug(`Synced ${items.length} CSQs`);
  }

  private extractIdFromRef(ref?: string): string | null {
    if (!ref || typeof ref !== 'string') return null;
    const parts = ref.split('/');
    return parts[parts.length - 1] || null;
  }

  /**
   * Fetch from UCCX adminapi. Handles both array and object-with-items responses.
   */
  private async fetchAdminApi<T>(path: string): Promise<T[]> {
    const { username, password } = this.getAuth();
    if (!username || !password) {
      throw new Error('UCCX_USERNAME and UCCX_PASSWORD required');
    }

    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const timeout = this.configService.get<number>('UCCX_TIMEOUT_MS', 30000);
    const maxRetries = this.configService.get<number>('UCCX_RETRY_ATTEMPTS', 2);

    for (let attempt = 0; attempt < this.uccxNodes.length * maxRetries; attempt++) {
      const node = this.uccxNodes[this.currentNodeIndex];
      const url = `${node.url}${path}`;

      try {
        this.logger.debug(`UCCX request: ${url}`);
        const response = await this.httpService.axiosRef.get(url, {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
          },
          httpsAgent: this.httpsAgent,
          timeout,
        });

        const data = response.data;
        if (Array.isArray(data)) return data as T[];
        if (data && Array.isArray(data.resource)) return data.resource as T[];
        if (data && Array.isArray(data.team)) return data.team as T[];
        if (data && Array.isArray(data.csq)) return data.csq as T[];
        if (data && Array.isArray(data.resources)) return data.resources as T[];
        if (data && Array.isArray(data.teams)) return data.teams as T[];
        if (data && Array.isArray(data.contactServiceQueues)) return data.contactServiceQueues as T[];
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const keys = Object.keys(data);
          const arrKey = keys.find((k) => Array.isArray((data as any)[k]));
          if (arrKey) return (data as any)[arrKey] as T[];
        }
        return [];
      } catch (error) {
        this.logger.warn(
          `UCCX node ${node.host} failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
        this.currentNodeIndex = (this.currentNodeIndex + 1) % this.uccxNodes.length;
        if (attempt === this.uccxNodes.length * maxRetries - 1) {
          throw new Error(`UCCX unavailable: all nodes failed`);
        }
        await this.sleep(Math.min(1000 * Math.pow(2, attempt), 10000));
      }
    }
    return [];
  }

  /**
   * Backfill existing recordings with agent name and team using extension mapping
   */
  private async backfillRecordingsByExtension(): Promise<void> {
    const recordings = await this.prisma.recording.findMany({
      where: {
        OR: [
          { agentName: null },
          { teamName: null },
          { agentId: null },
          { teamCode: null },
        ],
        extension: { not: null },
      },
      select: {
        id: true,
        extension: true,
        agentId: true,
        teamCode: true,
        agentName: true,
        teamName: true,
      },
    });

    let updated = 0;
    for (const rec of recordings) {
      const ext = rec.extension?.trim();
      if (!ext) continue;

      const agent = await this.prisma.agent.findFirst({
        where: { extension: ext },
        include: {
          teams: {
            include: { team: true },
            take: 1,
          },
        },
      });

      if (!agent) continue;

      const team = agent.teams[0]?.team;
      const teamCode = team?.teamCode ?? null;
      const teamName = team?.displayName ?? null;

      await this.prisma.recording.update({
        where: { id: rec.id },
        data: {
          agentId: agent.id,
          agentName: agent.fullName,
          teamCode,
          teamName,
        },
      });
      updated++;
    }
    if (updated > 0) {
      this.logger.log(`Backfilled ${updated} recordings with agent/team by extension`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
