import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Request,
  Response,
  Headers,
  StreamableFile,
  Logger,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Response as ExpressResponse } from 'express';
import { RecordingsService } from './recordings.service';
import { RecordingsSearchService, SearchRequest, AccessControl } from './recordings-search.service';
import { RecordingsStreamService } from './recordings-stream.service';
import { ExportService } from './export.service';
import { Roles } from '@/common/decorators/roles.decorator';
// import { Role } from '@prisma/client';
import { Role } from '@/types/shared';

@ApiTags('Recordings')
@ApiBearerAuth()
@Controller('recordings')
export class RecordingsController {
  private readonly logger = new Logger('RecordingsController');

  constructor(
    private readonly recordingsService: RecordingsService,
    private readonly searchService: RecordingsSearchService,
    private readonly streamService: RecordingsStreamService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * Search recordings with filters and facets
   */
  @Get('search')
  @ApiOperation({ summary: 'Search recordings with filters, facets, and pagination' })
  @ApiQuery({ name: 'q', required: false, description: 'Full-text search query' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date (ISO 8601)' })
  @ApiQuery({ name: 'durationFrom', required: false, description: 'Min duration in seconds' })
  @ApiQuery({ name: 'durationTo', required: false, description: 'Max duration in seconds' })
  @ApiQuery({ name: 'direction', required: false, description: 'inbound, outbound, internal' })
  @ApiQuery({ name: 'agentIds', required: false, description: 'Comma-separated agent IDs' })
  @ApiQuery({ name: 'teamCodes', required: false, description: 'Comma-separated team codes' })
  @ApiQuery({ name: 'queueIds', required: false, description: 'Comma-separated CSQ/queue IDs' })
  @ApiQuery({ name: 'ani', required: false, description: 'Caller number (partial match)' })
  @ApiQuery({ name: 'dnis', required: false, description: 'Dialed number (partial match)' })
  @ApiQuery({ name: 'callId', required: false, description: 'Call ID (exact match)' })
  @ApiQuery({ name: 'sessionId', required: false, description: 'MediaSense session ID' })
  @ApiQuery({ name: 'tags', required: false, description: 'Comma-separated tags' })
  @ApiQuery({ name: 'hasAudio', required: false, description: 'Filter by audio availability' })
  @ApiQuery({ name: 'sort', required: false, description: 'Sort field: startTime, endTime, duration, score' })
  @ApiQuery({ name: 'order', required: false, description: 'Sort order: asc or desc' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Items per page (max 100)' })
  async search(@Query() query: any, @Request() req: any) {
    const searchRequest: SearchRequest = {
      filters: {
        q: query.q,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        durationFrom: query.durationFrom ? parseInt(query.durationFrom) : undefined,
        durationTo: query.durationTo ? parseInt(query.durationTo) : undefined,
        direction: query.direction,
        agentIds: query.agentIds ? query.agentIds.split(',') : undefined,
        teamCodes: query.teamCodes ? query.teamCodes.split(',') : undefined,
        queueIds: query.queueIds ? query.queueIds.split(',') : undefined,
        ani: query.ani,
        dnis: query.dnis,
        callId: query.callId,
        sessionId: query.sessionId,
        tags: query.tags ? query.tags.split(',') : undefined,
        hasAudio: query.hasAudio === 'true' ? true : query.hasAudio === 'false' ? false : undefined,
        wrapUpReasons: query.wrapUpReasons ? query.wrapUpReasons.split(',') : undefined,
      },
      sort: query.sort ? {
        field: query.sort as any,
        order: (query.order || 'desc') as 'asc' | 'desc',
      } : undefined,
      page: Math.max(1, parseInt(query.page) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(query.pageSize) || 20)),
    };

    const accessControl: AccessControl = {
      role: req.user.roles?.[0] || req.user.role || 'USER',
      userId: req.user.sub || req.user.id,
      agentId: req.user.agentId,
      teamCodes: req.user.teamCodes || [],
    };

    return this.searchService.search(searchRequest, accessControl);
  }

  /**
   * Get filter options for dropdowns
   */
  @Get('filter-options/:field')
  @ApiOperation({ summary: 'Get distinct values for filter dropdowns' })
  @ApiParam({ name: 'field', enum: ['agents', 'teams', 'queues', 'wrapUpReasons', 'tags'] })
  @ApiQuery({ name: 'search', required: false, description: 'Search text' })
  async getFilterOptions(
    @Param('field') field: 'agents' | 'teams' | 'queues' | 'wrapUpReasons' | 'tags',
    @Query('search') search: string,
    @Request() req: any,
  ) {
    const accessControl: AccessControl = {
      role: req.user.roles?.[0] || req.user.role || 'USER',
      userId: req.user.sub || req.user.id,
      agentId: req.user.agentId,
      teamCodes: req.user.teamCodes || [],
    };

    return this.searchService.getFilterOptions(field, accessControl, search);
  }

  /**
   * Get recording details
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get recording details with metadata' })
  @ApiParam({ name: 'id', description: 'Recording ID' })
  async getRecording(@Param('id') id: string, @Request() req: any) {
    const recording = await this.recordingsService.getRecordingDetails(
      id,
      req.user.sub || req.user.id,
      req.user.roles?.[0] || req.user.role || 'USER',
    );

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    // Check audio availability
    const audioStatus = await this.streamService.checkAudioAvailability(id);

    return {
      ...recording,
      audioStatus,
    };
  }

  /**
   * Stream audio for browser playback (proxy to MediaSense)
   * Supports HTTP Range for seeking
   */
  @Get(':id/stream')
  @ApiOperation({ summary: 'Stream audio from MediaSense (proxy with Range support)' })
  @ApiParam({ name: 'id', description: 'Recording ID' })
  @ApiResponse({ status: 200, description: 'Audio stream' })
  @ApiResponse({ status: 206, description: 'Partial content (Range request)' })
  async streamRecording(
    @Param('id') id: string,
    @Headers('range') range: string | undefined,
    @Request() req: any,
    @Response() res: ExpressResponse,
  ) {
    // Verify access
    const hasAccess = await this.recordingsService.checkAccess(
      id,
      req.user.sub || req.user.id,
      req.user.roles?.[0] || req.user.role || 'USER',
    );

    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this recording');
    }

    // Log audit event
    await this.recordingsService.logPlaybackEvent(id, req.user.sub || req.user.id);

    // Stream audio
    const streamResult = await this.streamService.streamAudio(id, range);

    // Set response headers
    res.setHeader('Content-Type', streamResult.contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    
    if (streamResult.contentLength) {
      res.setHeader('Content-Length', streamResult.contentLength);
    }

    if (streamResult.contentRange) {
      res.status(HttpStatus.PARTIAL_CONTENT);
      res.setHeader('Content-Range', streamResult.contentRange);
    }

    // Pipe the stream
    streamResult.stream.pipe(res);
  }

  /**
   * Download recording as MP3
   * If transcoding is needed, may queue an export job
   */
  @Get(':id/download')
  @ApiOperation({ summary: 'Download recording as MP3' })
  @ApiParam({ name: 'id', description: 'Recording ID' })
  @ApiQuery({ name: 'format', required: false, description: 'Output format (mp3, wav, ogg)' })
  async downloadRecording(
    @Param('id') id: string,
    @Query('format') format: string = 'mp3',
    @Request() req: any,
    @Response() res: ExpressResponse,
  ) {
    // Verify access
    const hasAccess = await this.recordingsService.checkAccess(
      id,
      req.user.sub || req.user.id,
      req.user.roles?.[0] || req.user.role || 'USER',
    );

    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this recording');
    }

    // Validate format
    const allowedFormats = ['mp3', 'wav', 'ogg'];
    if (!allowedFormats.includes(format.toLowerCase())) {
      throw new BadRequestException(`Invalid format. Allowed: ${allowedFormats.join(', ')}`);
    }

    // Get recording for filename
    const recording = await this.recordingsService.getRecordingBasic(id);
    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    // Try to get cached/transcoded file
    const downloadResult = await this.exportService.getOrCreateDownload(
      id,
      format.toLowerCase(),
      req.user.sub || req.user.id,
    );

    if (downloadResult.status === 'ready') {
      // File is ready - stream it (actualFormat when fallback to WAV without ffmpeg)
      const outFormat = downloadResult.actualFormat || format;
      const filename = this.buildFilename(recording, outFormat);
      
      res.setHeader('Content-Type', downloadResult.contentType!);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      if (downloadResult.contentLength) {
        res.setHeader('Content-Length', downloadResult.contentLength);
      }

      downloadResult.stream!.pipe(res);
    } else if (downloadResult.status === 'processing') {
      // Job is in progress - return job ID
      res.status(HttpStatus.ACCEPTED).json({
        status: 'processing',
        jobId: downloadResult.jobId,
        message: 'Export is being processed. Check status with GET /recordings/exports/:jobId',
      });
    } else {
      throw new BadRequestException(downloadResult.error || 'Export failed');
    }
  }

  /**
   * Request MP3 export (async)
   */
  @Post(':id/export')
  @ApiOperation({ summary: 'Request async export/conversion job' })
  @ApiParam({ name: 'id', description: 'Recording ID' })
  async requestExport(
    @Param('id') id: string,
    @Body() body: { format?: string; quality?: string },
    @Request() req: any,
  ) {
    // Verify access
    const hasAccess = await this.recordingsService.checkAccess(
      id,
      req.user.sub || req.user.id,
      req.user.roles?.[0] || req.user.role || 'USER',
    );

    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this recording');
    }

    const format = body.format || 'mp3';
    const quality = body.quality || 'standard';

    const job = await this.exportService.createExportJob(
      id,
      format,
      quality,
      req.user.sub || req.user.id,
    );

    return {
      jobId: job.id,
      status: job.status,
      message: 'Export job created. Check status with GET /recordings/exports/:jobId',
    };
  }

  /**
   * Get export job status
   */
  @Get('exports/:jobId')
  @ApiOperation({ summary: 'Get export job status' })
  @ApiParam({ name: 'jobId', description: 'Export job ID' })
  async getExportStatus(@Param('jobId') jobId: string, @Request() req: any) {
    const job = await this.exportService.getJobStatus(jobId);

    if (!job) {
      throw new NotFoundException('Export job not found');
    }

    // Verify user owns this job or is admin
    if (job.requestedBy !== req.user.sub && !['ADMIN', 'QA'].includes(req.user.roles?.[0])) {
      throw new ForbiddenException('Access denied to this export job');
    }

    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      format: job.format,
      downloadUrl: job.status === 'COMPLETED' ? `/recordings/exports/${jobId}/download` : undefined,
      error: job.errorMessage,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  }

  /**
   * Download exported file
   */
  @Get('exports/:jobId/download')
  @ApiOperation({ summary: 'Download completed export' })
  @ApiParam({ name: 'jobId', description: 'Export job ID' })
  async downloadExport(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Response() res: ExpressResponse,
  ) {
    const job = await this.exportService.getJobStatus(jobId);

    if (!job) {
      throw new NotFoundException('Export job not found');
    }

    if (job.status !== 'COMPLETED') {
      throw new BadRequestException(`Export not ready. Status: ${job.status}`);
    }

    // Verify user owns this job or is admin
    if (job.requestedBy !== req.user.sub && !['ADMIN', 'QA'].includes(req.user.roles?.[0])) {
      throw new ForbiddenException('Access denied to this export job');
    }

    const downloadResult = await this.exportService.getExportedFile(jobId);

    if (!downloadResult.success) {
      throw new NotFoundException(downloadResult.error || 'Export file not found');
    }

    const filename = `recording-${job.recordingId}.${job.format}`;
    
    res.setHeader('Content-Type', downloadResult.contentType!);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    if (downloadResult.contentLength) {
      res.setHeader('Content-Length', downloadResult.contentLength);
    }

    downloadResult.stream!.pipe(res);
  }

  /**
   * Add tag to recording
   */
  @Post(':id/tags')
  @ApiOperation({ summary: 'Add tag to recording' })
  async addTag(
    @Param('id') id: string,
    @Body() body: { tagName: string; tagValue?: string },
    @Request() req: any,
  ) {
    const hasAccess = await this.recordingsService.checkAccess(
      id,
      req.user.sub || req.user.id,
      req.user.roles?.[0] || req.user.role || 'USER',
    );

    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.recordingsService.addTag(id, body.tagName, body.tagValue, req.user.sub);
  }

  /**
   * Add note to recording
   */
  @Post(':id/notes')
  @ApiOperation({ summary: 'Add note to recording' })
  async addNote(
    @Param('id') id: string,
    @Body() body: { noteText: string; timestamp?: number },
    @Request() req: any,
  ) {
    const hasAccess = await this.recordingsService.checkAccess(
      id,
      req.user.sub || req.user.id,
      req.user.roles?.[0] || req.user.role || 'USER',
    );

    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return this.recordingsService.addNote(id, body.noteText, body.timestamp, req.user.sub);
  }

  // ============================================================================
  // Admin endpoints
  // ============================================================================

  /**
   * Get sync status (admin only)
   */
  @Get('admin/sync-status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get MediaSense sync status (Admin only)' })
  async getSyncStatus() {
    return this.recordingsService.getSyncStatus();
  }

  /**
   * Trigger manual sync (admin only)
   */
  @Post('admin/sync-now')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Trigger manual MediaSense sync (Admin only)' })
  async triggerSync() {
    return this.recordingsService.triggerSync();
  }

  /**
   * Reset sync state (admin only)
   */
  @Post('admin/sync-reset')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reset sync state (Admin only)' })
  async resetSync() {
    return this.recordingsService.resetSync();
  }

  /**
   * Get sync diagnostics for troubleshooting (admin only)
   */
  @Get('admin/sync-diagnostics')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get MediaSense sync diagnostics (Admin only)' })
  async getSyncDiagnostics() {
    return this.recordingsService.getSyncDiagnostics();
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private buildFilename(recording: any, format: string): string {
    const date = new Date(recording.startTime);
    const dateStr = date.toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const agent = recording.agentName || recording.agentId || 'unknown';
    const ani = recording.ani || '';
    
    // Sanitize for filename
    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    
    return `recording_${dateStr}_${sanitize(agent)}_${sanitize(ani)}.${format}`;
  }
}
