import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  StreamableFile,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RecordingsService } from './recordings.service';
import { SearchRequest } from '@/types/shared';

@ApiTags('Recordings')
@ApiBearerAuth()
@Controller('api/recordings')
export class RecordingsController {
  private readonly logger = new Logger('RecordingsController');

  constructor(private readonly recordingsService: RecordingsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search recordings with filters' })
  async search(@Query() query: any, @Request() req: any) {
    const searchRequest: SearchRequest = {
      query: query.query,
      filters: {
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        agentIds: query.agentIds ? query.agentIds.split(',') : undefined,
        teamCodes: query.teamCodes ? query.teamCodes.split(',') : undefined,
        csqs: query.csqs ? query.csqs.split(',') : undefined,
      },
      page: parseInt(query.page) || 1,
      pageSize: parseInt(query.pageSize) || 20,
      sort: {
        field: query.sortBy || 'startTime',
        order: (query.sortOrder || 'desc') as 'asc' | 'desc',
      },
    };

    return this.recordingsService.searchRecordings(
      searchRequest,
      req.user.sub,
      req.user.roles[0],
      req.user.teamCodes || [],
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get recording details' })
  async getRecording(@Param('id') id: string, @Request() req: any) {
    return this.recordingsService.getRecordingDetails(id, req.user.sub, req.user.roles[0]);
  }

  @Get(':id/stream')
  @ApiOperation({ summary: 'Stream audio from MediaSense (secure proxy)' })
  async streamRecording(@Param('id') id: string, @Request() req: any): Promise<StreamableFile> {
    // TODO: Implement secure audio streaming
    // 1. Verify access to recording
    // 2. Get MediaSense URL
    // 3. Proxy stream with Range support
    // 4. Log audit event
    throw new Error('Not implemented - TODO');
  }
}
