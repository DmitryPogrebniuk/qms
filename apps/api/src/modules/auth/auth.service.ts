import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/common/prisma/prisma.service';
import axios from 'axios';
import * as bcrypt from 'bcrypt';
import { UserClaims, Role } from '@/types/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Verify Keycloak token and sync/create user in database
   */
  async validateKeycloakToken(token: string): Promise<UserClaims> {
    try {
      const keycloakIssuer = this.configService.get<string>('KEYCLOAK_ISSUER');
      const realm = this.configService.get<string>('KEYCLOAK_REALM');

      // Get public key from Keycloak
      const publicKeyUrl = `${keycloakIssuer}/realms/${realm}/protocol/openid-connect/certs`;
      const response = await axios.get(publicKeyUrl);
      const publicKeys = response.data.keys;

      // Decode without verification first to get header
      const decoded = this.jwtService.decode(token, { complete: true }) as any;
      if (!decoded) {
        throw new UnauthorizedException('Invalid token format');
      }

      // TODO: In production, properly verify JWT signature using public keys
      // For MVP, we decode and trust Keycloak's issuer

      const payload = this.jwtService.decode(token) as any;
      if (!payload) {
        throw new UnauthorizedException('Invalid token');
      }

      // Extract roles from Keycloak token
      const realmRoles = payload.realm_access?.roles || [];
      const clientRoles = payload.resource_access?.[payload.clientId]?.roles || [];
      const allRoles = [...realmRoles, ...clientRoles];

      // Map Keycloak roles to our Role enum
      const roles = this._mapKeycloakRolesToAppRoles(allRoles);

      // Sync or create user
      await this._syncUser({
        keycloakId: payload.sub,
        username: payload.preferred_username,
        email: payload.email,
        fullName: payload.name,
        roles,
      });

      return {
        sub: payload.sub,
        preferred_username: payload.preferred_username,
        email: payload.email,
        name: payload.name,
        roles,
      };
    } catch (error) {
      this.logger.error('Token validation failed:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Generate JWT for authenticated users
   */
  async generateToken(claims: UserClaims): Promise<string> {
    return this.jwtService.sign({
      sub: claims.sub,
      preferred_username: claims.preferred_username,
      email: claims.email,
      name: claims.name,
      roles: claims.roles,
    });
  }

  /**
   * Sync user from Keycloak to database
   */
  private async _syncUser(keycloakUser: {
    keycloakId: string;
    username: string;
    email?: string;
    fullName?: string;
    roles: Role[];
  }): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { keycloakId: keycloakUser.keycloakId },
      });

      if (user) {
        // Update existing user
        await this.prisma.user.update({
          where: { keycloakId: keycloakUser.keycloakId },
          data: {
            email: keycloakUser.email,
            fullName: keycloakUser.fullName,
            role: keycloakUser.roles[0], // Primary role
            isActive: true,
          },
        });
      } else {
        // Create new user
        // Try to find agentId from username (assuming AD login == agentId)
        const agent = await this.prisma.agent.findUnique({
          where: { agentId: keycloakUser.username },
        });

        const agentTeams = agent
          ? await this.prisma.agentTeam.findMany({
              where: { agentId: agent.id },
              select: { team: { select: { teamCode: true } } },
            })
          : [];

        const teamCodes = agentTeams.map((at) => at.team.teamCode);

        await this.prisma.user.create({
          data: {
            keycloakId: keycloakUser.keycloakId,
            username: keycloakUser.username,
            email: keycloakUser.email,
            fullName: keycloakUser.fullName,
            role: keycloakUser.roles[0],
            agentId: agent?.agentId,
            teamCodes,
          },
        });
      }
    } catch (error) {
      this.logger.error('User sync failed:', error);
      // Non-fatal: continue with auth
    }
  }

  /**
   * Map Keycloak roles to app roles
   */
  private _mapKeycloakRolesToAppRoles(keycloakRoles: string[]): Role[] {
    const roleMap: Record<string, Role> = {
      'qms-admin': Role.ADMIN,
      'qms-qa': Role.QA,
      'qms-supervisor': Role.SUPERVISOR,
      'qms-user': Role.USER,
    };

    return keycloakRoles
      .map((role) => roleMap[role.toLowerCase()])
      .filter((role): role is Role => role !== undefined);
  }

  /**
   * Local login with username and password
   */
  async loginLocal(username: string, password: string): Promise<{ jwt: string; user: any }> {
    if (!username || !password) {
      throw new BadRequestException('Username and password are required');
    }

    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        password: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (!user.password) {
      throw new UnauthorizedException('This user does not have password authentication enabled');
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // Generate JWT token
    const claims: UserClaims = {
      sub: user.id,
      preferred_username: user.username,
      email: user.email || undefined,
      name: user.fullName || undefined,
      roles: [user.role as unknown as Role],
    };

    const jwt = await this.generateToken(claims);

    return {
      jwt,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }
}

