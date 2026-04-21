import { createRedis } from '@exness/bus';
import { logger } from '@exness/logger';
import { SYMBOLS, type Symbol } from '@exness/shared';
import { evaluateTick, type Tick } from './evaluator.js';
import { startHealth } from './health.js';
import { OrderIndex } from './index_.js';
import { initMetrics } from './metrics.js';
import { rebuildIndex, startReconciler } from './reconciler.js';

type OrderAddPayload = {
  orderId: string;
  userId: string;
  asset: string;
  side: string;
  margin: string;
  leverage: number;
  openPrice: string;
  liquidationPrice: string;
  stopLoss: string | null;
  takeProfit: string | null;
  openedAt?: string;
};

async function main(): Promise<void> {
  const redisData = createRedis();
  const redisPubSub = createRedis();
  const index = new OrderIndex();

  startHealth(redisData, index);

  // 1. Bootstrap index from DB
  await rebuildIndex(index);
  initMetrics(redisData, index);

  // 2. Subscribe to orders:events for live deltas
  await redisPubSub.subscribe('orders:events');
  redisPubSub.on('message', (channel, raw) => {
    if (channel !== 'orders:events') return;
    try {
      const evt = JSON.parse(raw) as
        | { kind: 'add'; order: OrderAddPayload }
        | { kind: 'remove'; orderId: string };
      if (evt.kind === 'add') {
        const o = evt.order;
        index.add({
          orderId: o.orderId,
          userId: o.userId,
          asset: o.asset as Symbol,
          side: o.side as 'buy' | 'sell',
          margin: BigInt(o.margin),
          leverage: o.leverage,
          openPrice: BigInt(o.openPrice),
          liquidationPrice: BigInt(o.liquidationPrice),
          stopLoss: o.stopLoss ? BigInt(o.stopLoss) : null,
          takeProfit: o.takeProfit ? BigInt(o.takeProfit) : null,
          openedAt: o.openedAt ? new Date(o.openedAt) : new Date(),
        });
      } else if (evt.kind === 'remove') {
        index.remove(evt.orderId);
      }
    } catch (err) {
      logger.error({ err }, 'orders:events parse failed');
    }
  });

  // 3. Evaluate against latest:* before subscribing to live ticks (catches
  //    crash-and-restart case: SL already crossed while worker was down)
  for (const sym of SYMBOLS) {
    const raw = await redisData.get(`latest:${sym}`);
    if (!raw) continue;
    const p = JSON.parse(raw) as { buy: string; sell: string };
    const tick: Tick = { buy: BigInt(p.buy), sell: BigInt(p.sell) };
    await evaluateTick(redisData, index, sym, tick);
  }

  // 4. Subscribe to live ticks
  await redisPubSub.psubscribe('prices:*');
  redisPubSub.on('pmessage', (_pat, channel, raw) => {
    const sym = channel.split(':')[1] as Symbol;
    if (!SYMBOLS.includes(sym)) return;
    try {
      const p = JSON.parse(raw) as { buy: string; sell: string };
      void evaluateTick(redisData, index, sym, { buy: BigInt(p.buy), sell: BigInt(p.sell) });
    } catch (err) {
      logger.error({ err }, 'price tick parse failed');
    }
  });

  // 5. Start reconciler
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
