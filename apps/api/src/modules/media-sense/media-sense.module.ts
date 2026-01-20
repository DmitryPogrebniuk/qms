import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { MediaSenseIngestionService } from './media-sense-ingestion.service';
import { MediaSenseStreamService } from './media-sense-stream.service';

@Module({
  imports: [ConfigModule, HttpModule, PrismaModule],
  providers: [MediaSenseIngestionService, MediaSenseStreamService],
  exports: [MediaSenseIngestionService, MediaSenseStreamService],
})
export class MediaSenseModule {}
