import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEvaluationAnswerDto {
  @ApiProperty()
  @IsString()
  questionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class CreateEvaluationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recordingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scorecardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scorecardTemplateId?: string;

  @ApiPropertyOptional({ type: [CreateEvaluationAnswerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEvaluationAnswerDto)
  answers?: CreateEvaluationAnswerDto[];
}
