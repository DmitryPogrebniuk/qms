import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger('AuthController');

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login with username and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() credentials: { username: string; password: string }): Promise<{ jwt: string; user: any }> {
    try {
      const result = await this.authService.loginLocal(credentials.username, credentials.password);
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
      const claims = await this.authService.validateKeycloakToken(token);
      const jwt = await this.authService.generateToken(claims);
      this.logger.log(`User ${claims.preferred_username} authenticated`);
      return { jwt };
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      throw error;
    }
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  async refreshToken(@Body('token') token: string): Promise<{ jwt: string }> {
    const claims = await this.authService.validateKeycloakToken(token);
    const jwt = await this.authService.generateToken(claims);
    return { jwt };
  }
}
