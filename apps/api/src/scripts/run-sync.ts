/**
 * Standalone sync script — runs in child process, не блокує API.
 * Викликається: node dist/scripts/run-sync.js [incremental|reconcile] [dateFrom] [dateTo]
 */
import { NestFactory } from '@nestjs/core';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { AppModule } from '../app.module';
import { MediaSenseSyncService } from '../modules/media-sense/media-sense-sync.service';

const LOCK_FILE = '/tmp/qms-mediasense-sync.lock';

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'incremental';
  const dateFrom = args[1];
  const dateTo = args[2];

  try {
    writeFileSync(LOCK_FILE, String(process.pid));
  } catch {
    process.exit(2); // Lock failed
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const syncService = app.get(MediaSenseSyncService);

  try {
    if (mode === 'reconcile' && dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      const result = await syncService.runReconciliationSync(from, to, 'manual-child');
      console.log(JSON.stringify(result));
    } else {
      const result = await syncService.triggerSyncNow();
      console.log(JSON.stringify(result));
    }
  } finally {
    await app.close();
    try {
      if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
    } catch {}
  }
}

main().catch((err) => {
  console.error(err);
  try {
    if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
  } catch {}
  process.exit(1);
});
