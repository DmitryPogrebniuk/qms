import { PartialType } from '@nestjs/swagger';
import { CreateScorecardDto } from './create-scorecard.dto';

export class UpdateScorecardDto extends PartialType(CreateScorecardDto) {}
