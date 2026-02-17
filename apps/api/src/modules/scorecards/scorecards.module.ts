import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { ScorecardsService } from './scorecards.service';
import { ScorecardsController } from './scorecards.controller';

@Module({
  imports: [PrismaModule],
  providers: [ScorecardsService],
  controllers: [ScorecardsController],
  exports: [ScorecardsService],
})
export class ScorecardsModule {}
