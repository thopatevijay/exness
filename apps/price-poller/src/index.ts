import { logger } from '@exness/logger';
import { createRedis } from '@exness/bus';
import { connectBinance } from './binance.js';
import { publishTrade } from './publisher.js';
import { startHealth } from './health.js';

async function main(): Promise<void> {
  const redis = createRedis();
  const lastTickRef = { ts: Date.now() };

  startHealth(redis, lastTickRef);

  const conn = connectBinance({
    onTrade: (sym, trade) => {
      lastTickRef.ts = Date.now();
      publishTrade(redis, sym, trade).catch((err) =>
        logger.error({ err, sym }, 'publishTrade failed'),
      );
    },
  });

  const shutdown = (): void => {
    logger.info('shutting down');
    conn.close();
    void redis.quit();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('price-poller running');
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal');
  process.exit(1);
});
