import { createRedis } from '@exness/bus';
import { logger } from '@exness/logger';
import { startConsumer } from './consumer.js';
import { startHealth } from './health.js';

async function main(): Promise<void> {
  const redis = createRedis();
  startHealth(redis);
  await startConsumer(redis);
  logger.info('notifier running');

  process.on('SIGINT', () => {
    void redis.quit();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal');
  process.exit(1);
});
