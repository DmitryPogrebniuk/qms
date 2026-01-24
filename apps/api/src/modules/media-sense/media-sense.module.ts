import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { MediaSenseIngestionService } from './media-sense-ingestion.service';
import { MediaSenseStreamService } from './media-sense-stream.service';
import { MediaSenseClientService } from './media-sense-client.service';
import { MediaSenseLogger } from './media-sense-logger.service';
import { MediaSenseSyncService } from './media-sense-sync.service';
import { MediaSenseIntegrationController } from './media-sense-integration.controller';
import { OpenSearchModule } from '../opensearch/opensearch.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    OpenSearchModule,
    AuthModule,
  ],
  controllers: [MediaSenseIntegrationController],
  providers: [
    MediaSenseIngestionService,
    MediaSenseStreamService,
    MediaSenseClientService,
    MediaSenseLogger,
    MediaSenseSyncService,
  ],
  exports: [
    MediaSenseIngestionService,
    MediaSenseStreamService,
    MediaSenseClientService,
    MediaSenseLogger,
    MediaSenseSyncService,
  ],
})
export class MediaSenseModule {}
