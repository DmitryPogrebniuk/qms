import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { OpenSearchModule } from '../opensearch/opensearch.module';
import { EvaluationsService } from './evaluations.service';
import { EvaluationsController } from './evaluations.controller';

@Module({
  imports: [PrismaModule, OpenSearchModule],
  providers: [EvaluationsService],
  controllers: [EvaluationsController],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
