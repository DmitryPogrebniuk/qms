import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  UseGuards,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RbacGuard } from '@/common/guards/rbac.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/types/shared';
import { MediaSenseClientService, TestConnectionResult } from './media-sense-client.service';
import { MediaSenseLogger, LogLevel, LogQueryResult } from './media-sense-logger.service';

/**
 * MediaSense Integration Controller
 * 
 * Endpoints:
 * - POST /integrations/mediasense/test - Test connection
 * - GET /integrations/mediasense/logs - Query logs
 * - POST /integrations/mediasense/logs/clear - Clear logs
 * - PUT /integrations/mediasense/logs/level - Set log level
 */

interface MediaSenseConfigDto {
  apiUrl: string;
  apiKey: string;
  apiSecret: string;
  allowSelfSigned?: boolean;
  timeout?: number;
}

interface SetLogLevelDto {
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
}

@ApiTags('MediaSense Integration')
@ApiBearerAuth()
@Controller('integrations/mediasense')
@UseGuards(JwtAuthGuard, RbacGuard)
export class MediaSenseIntegrationController {
  constructor(
    private readonly mediaSenseClient: MediaSenseClientService,
    private readonly logger: MediaSenseLogger,
  ) {}

  /**
   * Test MediaSense connection
   */
  @Post('test')
  @HttpCode(200)
  @ApiOperation({ summary: 'Test MediaSense connection with provided credentials' })
  @Roles(Role.ADMIN)
  async testConnection(@Body() config: MediaSenseConfigDto): Promise<TestConnectionResult> {
    // Validate input
    if (!config.apiUrl) {
      return {
        success: false,
        message: 'API URL is required',
        recommendations: ['Provide MediaSense API URL (e.g., https://mediasense.example.com:8440)'],
      };
    }

    if (!config.apiKey || !config.apiSecret) {
      return {
        success: false,
        message: 'API Key and Secret are required',
        recommendations: ['Provide MediaSense credentials (username/password or API key/secret)'],
      };
    }

    // Configure client and test
    this.mediaSenseClient.configure({
      baseUrl: config.apiUrl,
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      allowSelfSigned: config.allowSelfSigned || false,
      timeout: config.timeout || 10000,
    });

    return this.mediaSenseClient.testConnection();
  }

  /**
   * Get logs with filtering and pagination
   */
  @Get('logs')
  @ApiOperation({ summary: 'Query MediaSense integration logs' })
  @ApiQuery({ name: 'level', required: false, enum: ['ERROR', 'WARN', 'INFO', 'DEBUG'] })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor (timestamp)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, description: 'Search in log messages' })
  @Roles(Role.ADMIN)
  async getLogs(
    @Query('level') level?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG',
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ): Promise<LogQueryResult> {
    return this.logger.queryLogs({
      level: level || 'INFO',
      cursor,
      limit: limit ? parseInt(limit, 10) : 100,
      search,
    });
  }

  /**
   * Clear logs
   */
  @Post('logs/clear')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear MediaSense integration logs' })
  @Roles(Role.ADMIN)
  async clearLogs(): Promise<{ success: boolean; message: string }> {
    await this.logger.clearLogs();
    return {
      success: true,
      message: 'Logs cleared successfully',
    };
  }

  /**
   * Set log level at runtime
   */
  @Put('logs/level')
  @HttpCode(200)
  @ApiOperation({ summary: 'Set MediaSense log level' })
  @Roles(Role.ADMIN)
  async setLogLevel(@Body() dto: SetLogLevelDto): Promise<{ 
    success: boolean; 
    level: string;
    message: string;
  }> {
    const validLevels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    if (!validLevels.includes(dto.level)) {
      throw new BadRequestException(`Invalid log level. Must be one of: ${validLevels.join(', ')}`);
    }

    this.logger.setLevel(dto.level);

    return {
      success: true,
      level: dto.level,
      message: `Log level set to ${dto.level}`,
    };
  }

  /**
   * Get current log level
   */
  @Get('logs/level')
  @ApiOperation({ summary: 'Get current MediaSense log level' })
  @Roles(Role.ADMIN)
  async getLogLevel(): Promise<{ level: string }> {
    return {
      level: this.logger.getLevelName(),
    };
  }

  /**
   * Get MediaSense integration status
   */
  @Get('status')
  @ApiOperation({ summary: 'Get MediaSense integration status' })
  @Roles(Role.ADMIN)
  async getStatus(): Promise<{
    configured: boolean;
    logLevel: string;
    logBufferSize: number;
  }> {
    const logs = await this.logger.queryLogs({ limit: 1 });
    
    return {
      configured: true, // Will be updated based on stored config
      logLevel: this.logger.getLevelName(),
      logBufferSize: logs.totalLines,
    };
  }
}
