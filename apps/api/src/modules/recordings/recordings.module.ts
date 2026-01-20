import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { RecordingsService } from './recordings.service';
import { RecordingsController } from './recordings.controller';
import { MediaSenseModule } from '../media-sense/media-sense.module';
import { OpenSearchModule } from '../opensearch/opensearch.module';

@Module({
  imports: [PrismaModule, MediaSenseModule, OpenSearchModule],
  providers: [RecordingsService],
  controllers: [RecordingsController],
  exports: [RecordingsService],
})
export class RecordingsModule {}
