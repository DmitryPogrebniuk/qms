import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ScorecardsService } from './scorecards.service';
import { CreateScorecardDto } from './dto/create-scorecard.dto';
import { UpdateScorecardDto } from './dto/update-scorecard.dto';
import { RequireRoles } from '@/common/decorators/roles.decorator';
import { Role } from '@/types/shared';

@ApiTags('Scorecards')
@ApiBearerAuth()
@Controller('scorecards')
export class ScorecardsController {
  constructor(private readonly scorecardsService: ScorecardsService) {}

  @Post()
  @RequireRoles(Role.QA, Role.ADMIN)
  @ApiOperation({ summary: 'Create scorecard' })
  async create(@Body() dto: CreateScorecardDto, @Request() req: any) {
    return this.scorecardsService.create(
      {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
        sections: dto.sections,
      },
      req.user.sub,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List scorecards' })
  async findAll(@Query('includeInactive') includeInactive?: string) {
    return this.scorecardsService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get scorecard by ID' })
  async findOne(@Param('id') id: string) {
    return this.scorecardsService.findOne(id);
  }

  @Put(':id')
  @RequireRoles(Role.QA, Role.ADMIN)
  @ApiOperation({ summary: 'Update scorecard' })
  async update(@Param('id') id: string, @Body() dto: UpdateScorecardDto) {
    return this.scorecardsService.update(id, {
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive,
      sections: dto.sections,
    });
  }

  @Delete(':id')
  @RequireRoles(Role.QA, Role.ADMIN)
  @ApiOperation({ summary: 'Delete scorecard' })
  async remove(@Param('id') id: string) {
    return this.scorecardsService.remove(id);
  }
}
