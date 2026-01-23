import { Module } from '@nestjs/common';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { RecordingsService } from './recordings.service';
import { RecordingsSearchService } from './recordings-search.service';
import { RecordingsStreamService } from './recordings-stream.service';
import { ExportService } from './export.service';
import { RecordingsController } from './recordings.controller';
import { MediaSenseModule } from '../media-sense/media-sense.module';
import { OpenSearchModule } from '../opensearch/opensearch.module';

@Module({
  imports: [PrismaModule, MediaSenseModule, OpenSearchModule],
  providers: [
    RecordingsService,
    RecordingsSearchService,
    RecordingsStreamService,
    ExportService,
  ],
  controllers: [RecordingsController],
  exports: [RecordingsService, RecordingsSearchService, RecordingsStreamService, ExportService],
})
export class RecordingsModule {}
