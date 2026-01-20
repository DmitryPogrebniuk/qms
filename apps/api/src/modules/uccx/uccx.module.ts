import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { UCCXDirectorySyncService } from './uccx-directory-sync.service';
import { UCCXHistoricalStatsService } from './uccx-historical-stats.service';

@Module({
  imports: [ConfigModule, HttpModule, PrismaModule],
  providers: [UCCXDirectorySyncService, UCCXHistoricalStatsService],
  exports: [UCCXDirectorySyncService, UCCXHistoricalStatsService],
})
export class UccxModule {}
