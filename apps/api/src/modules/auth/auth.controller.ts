import { Controller, Post, Body, Req, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger('AuthController');

  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login with username and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() credentials: { username: string; password: string },
    @Req() req: any,
  ): Promise<{ jwt: string; user: any }> {
    try {
      const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
      const userAgent = req.headers?.['user-agent'];
      const result = await this.authService.loginLocal(credentials.username, credentials.password, {
        ipAddress: ip,
        userAgent,
      });
      this.logger.log(`User ${credentials.username} logged in successfully`);
      return result;
    } catch (error) {
      this.logger.error('Login failed:', error);
      throw error;
    }
  }

  @Post('verify-token')
  @Public()
  @ApiOperation({ summary: 'Verify Keycloak token and get JWT' })
  @ApiResponse({ status: 200, description: 'Token verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid token' })
  async verifyToken(@Body('token') token: string): Promise<{ jwt: string }> {
    try {
      const result = await this.authService.verifyKeycloakAndCreateSession(token);
      this.logger.log(`User ${result.claims.preferred_username} authenticated`);
      return { jwt: result.jwt };
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      throw error;
    }
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  async refreshToken(@Body('token') token: string): Promise<{ jwt: string }> {
    const result = await this.authService.verifyKeycloakAndCreateSession(token);
    return { jwt: result.jwt };
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Req() req: any): Promise<{ ok: boolean }> {
    const sessionId = req.user?.sessionId;
    if (sessionId) {
      await this.sessionService.invalidate(sessionId);
    }
    return { ok: true };
  }
}
