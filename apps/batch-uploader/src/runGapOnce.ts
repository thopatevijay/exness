// One-off runner to trigger a full startup backfill (7 days) and exit.
// Usage: tsx apps/batch-uploader/src/runGapOnce.ts
import { logger } from '@exness/logger';
import { runStartupBackfill } from './gapFiller.js';

async function main(): Promise<void> {
  logger.info('gap-fill: manual run starting');
  await runStartupBackfill();
  logger.info('gap-fill: manual run done');
  process.exit(0);
}

main().catch((err) => {
  logger.fatal({ err }, 'gap-fill one-off failed');
  process.exit(1);
});
