import { logger } from '@exness/logger';
import type { Symbol } from '@exness/shared';
import type { Redis } from 'ioredis';
import { closeOrder } from './close.js';
import type { IndexedOrder, OrderIndex } from './index_.js';

export type Tick = { buy: bigint; sell: bigint };

export async function evaluateTick(
  redis: Redis,
  index: OrderIndex,
  asset: Symbol,
  tick: Tick,
): Promise<void> {
  // Longs exit at SELL price.
  // Order matters: liquidation first (it dwarfs SL/TP), then SL, then TP.
  for (const o of index.iterate(asset, 'buy')) {
    if (tick.sell <= o.liquidationPrice) {
      void closeAndRemove(redis, index, o, tick.sell, 'liquidation');
      continue;
    }
    if (o.stopLoss !== null && tick.sell <= o.stopLoss) {
      void closeAndRemove(redis, index, o, tick.sell, 'sl');
      continue;
    }
    if (o.takeProfit !== null && tick.sell >= o.takeProfit) {
      void closeAndRemove(redis, index, o, tick.sell, 'tp');
      continue;
    }
  }

  // Shorts exit at BUY price.
  for (const o of index.iterate(asset, 'sell')) {
    if (tick.buy >= o.liquidationPrice) {
      void closeAndRemove(redis, index, o, tick.buy, 'liquidation');
      continue;
    }
    if (o.stopLoss !== null && tick.buy >= o.stopLoss) {
      void closeAndRemove(redis, index, o, tick.buy, 'sl');
      continue;
    }
    if (o.takeProfit !== null && tick.buy <= o.takeProfit) {
      void closeAndRemove(redis, index, o, tick.buy, 'tp');
      continue;
    }
  }
}

async function closeAndRemove(
  redis: Redis,
  index: OrderIndex,
  order: IndexedOrder,
  exit: bigint,
  reason: 'sl' | 'tp' | 'liquidation',
): Promise<void> {
  // Optimistic local removal so subsequent ticks don't re-attempt
  index.remove(order.orderId);
  const ok = await closeOrder(redis, order, exit, reason);
  if (!ok) {
    logger.warn({ orderId: order.orderId, reason }, 'close lost race; index already cleaned');
  }
}
