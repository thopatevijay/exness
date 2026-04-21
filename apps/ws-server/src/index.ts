import { createRedis } from '@exness/bus';
import { logger } from '@exness/logger';
import { startHealth } from './health.js';
import { startOrderFanout } from './orderFanout.js';
import { startPricesFanout } from './pricesFanout.js';
import { startWsServer } from './server.js';

async function main(): Promise<void> {
  // Two redis clients — pub/sub blocks the connection
  const redisPubSub = createRedis();
  const redisStreams = createRedis();

  const reg = startWsServer();
  startPricesFanout(redisPubSub, reg);
  startHealth(redisStreams, reg);

  process.on('SIGINT', () => {
    void redisPubSub.quit();
    void redisStreams.quit();
    process.exit(0);
  });

  logger.info('ws-server running');
  await startOrderFanout(redisStreams, reg);
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal');
  process.exit(1);
});
