import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Agent, Team, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger('UsersService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current user profile
   */
  async getCurrentUserProfile(keycloakId: string) {
    return this.prisma.user.findUnique({
      where: { keycloakId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        agentId: true,
        teamCodes: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get agents for dropdown/selection
   */
  async getAllAgents() {
    return this.prisma.agent.findMany({
      where: { activeFlag: true },
      select: {
        id: true,
        agentId: true,
        fullName: true,
        email: true,
      },
    });
  }

  /**
   * Get teams for dropdown/selection
   */
  async getAllTeams() {
    return this.prisma.team.findMany({
      select: {
        id: true,
        teamCode: true,
        displayName: true,
      },
    });
  }

  /**
   * Get user's accessible teams based on role and team membership
   */
  async getUserAccessibleTeams(userId: string, userRole: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (userRole === 'ADMIN') {
      return this.prisma.team.findMany();
    }

    if (userRole === 'QA') {
      return this.prisma.team.findMany();
    }

    if (userRole === 'SUPERVISOR') {
      return this.prisma.team.findMany({
        where: { teamCode: { in: user?.teamCodes || [] } },
      });
    }

    // USER role - their own team only
    return this.prisma.team.findMany({
      where: { teamCode: { in: user?.teamCodes || [] } },
    });
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamCode: string) {
    return this.prisma.agent.findMany({
      where: {
        teams: {
          some: {
            team: {
              teamCode,
            },
          },
        },
      },
      select: {
        id: true,
        agentId: true,
        fullName: true,
        email: true,
        activeFlag: true,
      },
    });
  }

  /**
   * Get all local users
   */
  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Create a new local user
   */
  async createUser(data: {
    username: string;
    password: string;
    email?: string;
    fullName?: string;
    role?: Role;
  }) {
    // Validate username
    if (!data.username || data.username.trim().length === 0) {
      throw new BadRequestException('Username is required');
    }

    if (!data.password || data.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existingUser) {
      throw new BadRequestException('User with this username already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    return this.prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        email: data.email,
        fullName: data.fullName,
        role: data.role || 'USER',
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * Update user
   */
  async updateUser(
    id: string,
    data: {
      email?: string;
      fullName?: string;
      role?: Role;
      isActive?: boolean;
      password?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {
      email: data.email !== undefined ? data.email : user.email,
      fullName: data.fullName !== undefined ? data.fullName : user.fullName,
      role: data.role !== undefined ? data.role : user.role,
      isActive: data.isActive !== undefined ? data.isActive : user.isActive,
    };

    // Update password if provided
    if (data.password) {
      if (data.password.length < 6) {
        throw new BadRequestException('Password must be at least 6 characters long');
      }
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Delete user
   */
  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.delete({
      where: { id },
      select: {
        id: true,
        username: true,
      },
    });
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException('This user does not have password authentication enabled');
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters long');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
      select: {
        id: true,
        username: true,
      },
    });
  }
}
