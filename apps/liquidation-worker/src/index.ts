import { createRedis } from '@exness/bus';
import { logger } from '@exness/logger';
import { SYMBOLS, type Symbol } from '@exness/shared';
import { evaluateTick, type Tick } from './evaluator.js';
import { startHealth } from './health.js';
import { OrderIndex } from './index_.js';
import { initMetrics } from './metrics.js';
import { startOrderStreamConsumer } from './orderStream.js';
import { rebuildIndex, startReconciler } from './reconciler.js';

async function main(): Promise<void> {
  const redisData = createRedis();
  const redisPubSub = createRedis();
  const index = new OrderIndex();

  startHealth(redisData, index);

  // 1. Bootstrap index from DB
  await rebuildIndex(index);
  initMetrics(redisData, index);

  // 2. Stream consumer: trade_executed via cg:liq-index for live order
  //    lifecycle deltas. PEL gives at-least-once delivery across restarts.
  await startOrderStreamConsumer(redisData, index);

  // 3. Evaluate against latest:* before subscribing to live ticks (catches
  //    crash-and-restart case: SL already crossed while worker was down)
  for (const sym of SYMBOLS) {
    const raw = await redisData.get(`latest:${sym}`);
    if (!raw) continue;
    const p = JSON.parse(raw) as { ask: string; bid: string };
    const tick: Tick = { ask: BigInt(p.ask), bid: BigInt(p.bid) };
    await evaluateTick(redisData, index, sym, tick);
  }

  // 4. Subscribe to live price ticks (pub/sub — high-frequency, transient;
  //    keeping as pub/sub is the right call for prices)
  await redisPubSub.psubscribe('prices:*');
  redisPubSub.on('pmessage', (_pat, channel, raw) => {
    const sym = channel.split(':')[1] as Symbol;
    if (!SYMBOLS.includes(sym)) return;
    try {
      const p = JSON.parse(raw) as { ask: string; bid: string };
      void evaluateTick(redisData, index, sym, { ask: BigInt(p.ask), bid: BigInt(p.bid) });
    } catch (err) {
      logger.error({ err }, 'price tick parse failed');
    }
  });

  // 5. Start reconciler — backstops any drift the stream consumer might miss
  startReconciler(index);

  process.on('SIGINT', () => {
    void redisData.quit();
    void redisPubSub.quit();
    process.exit(0);
  });

  logger.info('liquidation-worker running');
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal');
  process.exit(1);
});
