import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { MediaSenseIngestionService } from './media-sense-ingestion.service';
import { MediaSenseStreamService } from './media-sense-stream.service';
import { MediaSenseClientService } from './media-sense-client.service';
import { MediaSenseLogger } from './media-sense-logger.service';
import { MediaSenseIntegrationController } from './media-sense-integration.controller';

@Module({
  imports: [ConfigModule, HttpModule, PrismaModule],
  controllers: [MediaSenseIntegrationController],
  providers: [
    MediaSenseIngestionService,
    MediaSenseStreamService,
    MediaSenseClientService,
    MediaSenseLogger,
  ],
  exports: [
    MediaSenseIngestionService,
    MediaSenseStreamService,
    MediaSenseClientService,
    MediaSenseLogger,
  ],
})
export class MediaSenseModule {}
