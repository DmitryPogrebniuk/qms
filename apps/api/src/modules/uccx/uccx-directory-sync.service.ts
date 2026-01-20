import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import https from 'https';

/**
 * Syncs teams, agents, skills from UCCX 15 as source of truth
 */
@Injectable()
export class UCCXDirectorySyncService {
  private readonly logger = new Logger('UCCXDirectorySyncService');
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false }); // For self-signed certs

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Full sync (nightly)
   */
  @Cron('0 2 * * *') // 2 AM daily
  async syncFull(): Promise<void> {
    this.logger.log('Starting full UCCX directory sync...');
    try {
      await this.prisma.syncState.upsert({
        where: { syncType: 'uccx_full' },
        update: { status: 'IN_PROGRESS' },
        create: { syncType: 'uccx_full', status: 'IN_PROGRESS' },
      });

      await this._syncTeams();
      await this._syncAgents();
      await this._syncSkills();
      await this._syncAgentSkills();

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
    }
  }

  /**
   * Incremental sync (every 10 minutes)
   */
  @Cron('*/10 * * * *')
  async syncIncremental(): Promise<void> {
    this.logger.debug('Running incremental UCCX sync...');
    try {
      const syncState = await this.prisma.syncState.findUnique({
        where: { syncType: 'uccx_incremental' },
      });

      // TODO: Implement incremental sync using watermark
      // For now, skip if recently synced
      if (syncState?.lastSyncedAt && Date.now() - syncState.lastSyncedAt.getTime() < 600000) {
        return;
      }

      await this._syncAgents();
    } catch (error) {
      this.logger.error('Incremental UCCX sync error:', error);
    }
  }

  /**
   * Sync teams from UCCX
   */
  private async _syncTeams(): Promise<void> {
    this.logger.debug('Syncing teams from UCCX...');
    try {
      const uccxTeams = await this._fetchFromUCCX('/teams');

      for (const team of uccxTeams) {
        await this.prisma.team.upsert({
          where: { teamCode: team.teamCode },
          update: {
            displayName: team.displayName,
            description: team.description,
            supervisorIds: team.supervisorIds || [],
            lastSyncedAt: new Date(),
          },
          create: {
            teamCode: team.teamCode,
            displayName: team.displayName,
            description: team.description,
            supervisorIds: team.supervisorIds || [],
            lastSyncedAt: new Date(),
          },
        });
      }

      this.logger.debug(`Synced ${uccxTeams.length} teams`);
    } catch (error) {
      this.logger.error('Team sync error:', error);
      throw error;
    }
  }

  /**
   * Sync agents from UCCX
   */
  private async _syncAgents(): Promise<void> {
    this.logger.debug('Syncing agents from UCCX...');
    try {
      const uccxAgents = await this._fetchFromUCCX('/agents');

      for (const agent of uccxAgents) {
        await this.prisma.agent.upsert({
          where: { agentId: agent.agentId },
          update: {
            fullName: agent.fullName,
            email: agent.email,
            activeFlag: agent.activeFlag,
            lastSyncedAt: new Date(),
          },
          create: {
            agentId: agent.agentId,
            fullName: agent.fullName,
            email: agent.email,
            activeFlag: agent.activeFlag,
            lastSyncedAt: new Date(),
          },
        });

        // Sync team membership
        await this._syncAgentTeamMembership(agent.agentId, agent.teamCodes || []);
      }

      this.logger.debug(`Synced ${uccxAgents.length} agents`);
    } catch (error) {
      this.logger.error('Agent sync error:', error);
      throw error;
    }
  }

  /**
   * Sync agent team membership
   */
  private async _syncAgentTeamMembership(agentId: string, teamCodes: string[]): Promise<void> {
    const agent = await this.prisma.agent.findUnique({ where: { agentId } });
    if (!agent) return;

    // Remove old team memberships
    await this.prisma.agentTeam.deleteMany({
      where: { agentId: agent.id },
    });

    // Add new team memberships
    for (const teamCode of teamCodes) {
      const team = await this.prisma.team.findUnique({ where: { teamCode } });
      if (team) {
        await this.prisma.agentTeam.create({
          data: {
            agentId: agent.id,
            teamId: team.id,
          },
        });
      }
    }
  }

  /**
   * Sync skills from UCCX
   */
  private async _syncSkills(): Promise<void> {
    this.logger.debug('Syncing skills from UCCX...');
    try {
      const uccxSkills = await this._fetchFromUCCX('/skills');

      for (const skill of uccxSkills) {
        await this.prisma.skill.upsert({
          where: { skillId: skill.skillId },
          update: {
            skillName: skill.skillName,
            description: skill.description,
            updatedAt: new Date(),
          },
          create: {
            skillId: skill.skillId,
            skillName: skill.skillName,
            description: skill.description,
          },
        });
      }

      this.logger.debug(`Synced ${uccxSkills.length} skills`);
    } catch (error) {
      this.logger.error('Skill sync error:', error);
      throw error;
    }
  }

  /**
   * Sync agent skills
   */
  private async _syncAgentSkills(): Promise<void> {
    this.logger.debug('Syncing agent skills from UCCX...');
    try {
      const agentSkills = await this._fetchFromUCCX('/agent-skills');

      for (const as of agentSkills) {
        const agent = await this.prisma.agent.findUnique({ where: { agentId: as.agentId } });
        const skill = await this.prisma.skill.findUnique({ where: { skillId: as.skillId } });

        if (agent && skill) {
          await this.prisma.agentSkill.upsert({
            where: { agentId_skillId: { agentId: agent.id, skillId: skill.id } },
            update: {
              proficiency: as.proficiency,
              updatedAt: new Date(),
            },
            create: {
              agentId: agent.id,
              skillId: skill.id,
              proficiency: as.proficiency,
            },
          });
        }
      }
    } catch (error) {
      this.logger.error('Agent skill sync error:', error);
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
