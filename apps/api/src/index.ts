import { createRedis } from '@exness/bus';
import { logger } from '@exness/logger';
import { startHealth } from './health.js';
import { startServer } from './server.js';

async function main(): Promise<void> {
  const redis = createRedis();
  startHealth(redis);
  startServer();
  process.on('SIGINT', () => {
    void redis.quit();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal');
  process.exit(1);
});
