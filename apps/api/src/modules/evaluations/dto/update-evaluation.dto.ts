import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateEvaluationAnswerDto } from './create-evaluation.dto';

export class UpdateEvaluationAnswerDto {
  @ApiPropertyOptional()
  @IsOptional()
  questionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  comment?: string;
}

export class UpdateEvaluationDto {
  @ApiPropertyOptional({ type: [UpdateEvaluationAnswerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateEvaluationAnswerDto)
  answers?: UpdateEvaluationAnswerDto[];

  @ApiPropertyOptional()
  @IsOptional()
  comments?: string;
}
