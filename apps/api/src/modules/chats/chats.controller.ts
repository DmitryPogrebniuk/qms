import { Controller, Get, Query, Param, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatsService } from './chats.service';
import { SearchRequest } from '@/types/shared';

@ApiTags('Chats')
@ApiBearerAuth()
@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search chats' })
  async search(@Query() query: any, @Request() req: any) {
    const searchRequest: SearchRequest = {
      query: query.query,
      filters: {
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      },
      page: parseInt(query.page) || 1,
      pageSize: parseInt(query.pageSize) || 20,
    };

    return this.chatsService.searchChats(
      searchRequest,
      req.user.sub,
      req.user.roles[0],
      req.user.teamCodes || [],
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get chat details' })
  async getChat(@Param('id') id: string) {
    return this.chatsService.getChatDetails(id);
  }
}
