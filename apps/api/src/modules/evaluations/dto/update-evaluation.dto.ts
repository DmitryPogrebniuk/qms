import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateEvaluationAnswerDto {
  @ApiProperty()
  @IsString()
  questionId: string;

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
