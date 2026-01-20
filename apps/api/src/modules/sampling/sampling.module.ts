import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { SamplingService } from './sampling.service';
import { SamplingController } from './sampling.controller';

@Module({
  imports: [PrismaModule],
  providers: [SamplingService],
  controllers: [SamplingController],
  exports: [SamplingService],
})
export class SamplingModule {}
