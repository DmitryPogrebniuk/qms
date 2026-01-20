import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { CoachingService } from './coaching.service';
import { CoachingController } from './coaching.controller';

@Module({
  imports: [PrismaModule],
  providers: [CoachingService],
  controllers: [CoachingController],
  exports: [CoachingService],
})
export class CoachingModule {}
