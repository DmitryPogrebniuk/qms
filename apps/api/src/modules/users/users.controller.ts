import { Controller, Get, Post, Put, Delete, Param, Body, Request, Logger, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/types/shared';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('api/users')
export class UsersController {
  private readonly logger = new Logger('UsersController');

  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req: any) {
    return this.usersService.getCurrentUserProfile(req.user.sub);
  }

  @Get('agents')
  @ApiOperation({ summary: 'Get all active agents' })
  async getAgents() {
    return this.usersService.getAllAgents();
  }

  @Get('teams')
  @ApiOperation({ summary: 'Get all teams' })
  async getTeams(@Request() req: any) {
    return this.usersService.getUserAccessibleTeams(req.user.sub, req.user.roles[0]);
  }

  @Get('teams/:teamCode/members')
  @ApiOperation({ summary: 'Get team members' })
  async getTeamMembers(@Param('teamCode') teamCode: string) {
    return this.usersService.getTeamMembers(teamCode);
  }

  /**
   * User Management Endpoints (Admin Only)
   */

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all local users (admin only)' })
  async getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create new local user (admin only)' })
  async createUser(
    @Body()
    data: {
      username: string;
      password: string;
      email?: string;
      fullName?: string;
      role?: string;
    },
  ) {
    return this.usersService.createUser(data as any);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update user (admin only)' })
  async updateUser(
    @Param('id') id: string,
    @Body()
    data: {
      email?: string;
      fullName?: string;
      role?: string;
      isActive?: boolean;
      password?: string;
    },
  ) {
    return this.usersService.updateUser(id, data as any);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete user (admin only)' })
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @Post(':id/change-password')
  @ApiOperation({ summary: 'Change own password' })
  async changePassword(
    @Param('id') id: string,
    @Request() req: any,
    @Body() data: { currentPassword: string; newPassword: string },
  ) {
    // Ensure user can only change their own password (unless admin)
    if (req.user.sub !== id && req.user.roles[0] !== 'admin') {
      throw new Error('Unauthorized');
    }
    return this.usersService.changePassword(id, data.currentPassword, data.newPassword);
  }
}
