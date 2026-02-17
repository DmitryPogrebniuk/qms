import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateScorecardQuestionDto {
  @ApiProperty()
  @IsString()
  text: string;

  @ApiProperty({ enum: ['YES_NO', 'SCALE', 'TEXT', 'DROPDOWN', 'CRITICAL'] })
  @IsString()
  type: 'YES_NO' | 'SCALE' | 'TEXT' | 'DROPDOWN' | 'CRITICAL';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  isCritical?: boolean;

  @ApiPropertyOptional({ description: 'For DROPDOWN: ["opt1","opt2"]; for SCALE: {min:1,max:5}' })
  @IsOptional()
  options?: string[] | { min: number; max: number };

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  order?: number;
}

export class CreateScorecardSectionDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ type: [CreateScorecardQuestionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateScorecardQuestionDto)
  questions?: CreateScorecardQuestionDto[];
}

export class CreateScorecardDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [CreateScorecardSectionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateScorecardSectionDto)
  sections?: CreateScorecardSectionDto[];
}
