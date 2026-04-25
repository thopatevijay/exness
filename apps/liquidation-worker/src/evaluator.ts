import { logger } from '@exness/logger';
import type { Symbol } from '@exness/shared';
import type { Redis } from 'ioredis';
import { closeOrder } from './close.js';
import type { IndexedOrder, OrderIndex } from './index_.js';

// Wire shape — ask = price to buy, bid = price to sell. Matches the
// {ask, bid} keys we publish on `latest:*` and `prices:*`.
export type Tick = { ask: bigint; bid: bigint };

export async function evaluateTick(
  redis: Redis,
  index: OrderIndex,
  asset: Symbol,
  tick: Tick,
): Promise<void> {
  // Longs (orders.side='buy') exit at the BID — you sell to close.
  // Order matters: liquidation first (it dwarfs SL/TP), then SL, then TP.
  for (const o of index.iterate(asset, 'buy')) {
    if (tick.bid <= o.liquidationPrice) {
      void closeAndRemove(redis, index, o, tick.bid, 'liquidation');
      continue;
    }
    if (o.stopLoss !== null && tick.bid <= o.stopLoss) {
      void closeAndRemove(redis, index, o, tick.bid, 'sl');
      continue;
    }
    if (o.takeProfit !== null && tick.bid >= o.takeProfit) {
      void closeAndRemove(redis, index, o, tick.bid, 'tp');
      continue;
    }
  }

  // Shorts (orders.side='sell') exit at the ASK — you buy to close.
  for (const o of index.iterate(asset, 'sell')) {
    if (tick.ask >= o.liquidationPrice) {
      void closeAndRemove(redis, index, o, tick.ask, 'liquidation');
      continue;
    }
    if (o.stopLoss !== null && tick.ask >= o.stopLoss) {
      void closeAndRemove(redis, index, o, tick.ask, 'sl');
      continue;
    }
    if (o.takeProfit !== null && tick.ask <= o.takeProfit) {
      void closeAndRemove(redis, index, o, tick.ask, 'tp');
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
