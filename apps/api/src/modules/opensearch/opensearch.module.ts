import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { OpenSearchService } from './opensearch.service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [OpenSearchService],
  exports: [OpenSearchService],
})
export class OpenSearchModule {}
