import { createRedis } from '@exness/bus';
import { logger } from '@exness/logger';
import { runConsumer } from './consumer.js';
import { startHealth } from './health.js';
import { initMetrics } from './metrics.js';

async function main(): Promise<void> {
  const redis = createRedis();
  startHealth(redis);
  initMetrics(redis);

  const shutdown = (): void => {
    logger.info('shutting down');
    void redis.quit();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('batch-uploader running');
  await runConsumer(redis);
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal');
  process.exit(1);
});
