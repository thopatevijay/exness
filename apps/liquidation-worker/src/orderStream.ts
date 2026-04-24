// Consume trade_executed via consumer group cg:liq-index to keep the
// in-memory OrderIndex in sync with DB lifecycle events.
//
// Why a stream (not pub/sub)?
//   - PEL gives at-least-once delivery. If the worker restarts or briefly
//     disconnects, unacked entries redeliver automatically on reconnect.
//   - Single source of truth — ws-server reads the same stream (via its own
//     consumer group cg:ws). No duplicate writes on the publisher side.
//
// The 30 s reconciler (reconciler.ts) remains as a belt-and-suspenders backstop
// for any drift the stream path might miss.

import { ensureGroup, readGroup, type StreamEntry } from '@exness/bus';
import { logger } from '@exness/logger';
import type { Side } from '@exness/money';
import type { Symbol } from '@exness/shared';
import type { Redis } from 'ioredis';
import type { OrderIndex } from './index_.js';

const STREAM = 'trade_executed';
const GROUP = 'cg:liq-index';
const CONSUMER = process.env.HOSTNAME ?? 'liquidation-worker';
const READ_COUNT = 50;
const BLOCK_MS = 1_000;

export async function startOrderStreamConsumer(
  redis: Redis,
  index: OrderIndex,
): Promise<void> {
  await ensureGroup(redis, STREAM, GROUP);
  // Fire-and-forget loop — any throw crashes the process so we notice; any
  // caught-and-logged errors within the loop don't stop consumption.
  void loop(redis, index);
}

async function loop(redis: Redis, index: OrderIndex): Promise<void> {
  while (true) {
    try {
      const entries = await readGroup(redis, GROUP, CONSUMER, [STREAM], READ_COUNT, BLOCK_MS);
      for (const e of entries) {
        try {
          handle(index, e);
        } catch (err) {
          logger.error({ err, id: e.id, type: e.data['type'] }, 'order stream handler failed');
        }
        await redis.xack(STREAM, GROUP, e.id);
      }
    } catch (err) {
      logger.error({ err }, 'cg:liq-index readGroup failed; backing off 1s');
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }
}

function handle(index: OrderIndex, entry: StreamEntry): void {
  const type = entry.data['type'];
  const orderId = entry.data['orderId'];
  if (!orderId) return;

  if (type === 'order_closed') {
    index.remove(orderId);
    return;
  }
  if (type !== 'order_opened' && type !== 'order_modified') {
    return;
  }
  // order_opened and order_modified both carry a full snapshot after Stage 26.
  // index.add() overwrites the existing entry, so modify is "upsert".
  const d = entry.data;
  const userId = d['userId'];
  const asset = d['asset'] as Symbol | undefined;
  const side = d['side'] as Side | undefined;
  const marginStr = d['margin'];
  const leverageStr = d['leverage'];
  const openPriceStr = d['openPrice'];
  const liqStr = d['liquidationPrice'];
  if (!userId || !asset || !side || !marginStr || !leverageStr || !openPriceStr || !liqStr) {
    logger.warn({ id: entry.id, type }, 'order stream entry missing required fields; skipping');
    return;
  }
  index.add({
    orderId,
    userId,
    asset,
    side,
    margin: BigInt(marginStr),
    // eslint-disable-next-line no-restricted-syntax -- ms/int field from stream text
    leverage: Number(leverageStr),
    openPrice: BigInt(openPriceStr),
    liquidationPrice: BigInt(liqStr),
    stopLoss: d['stopLoss'] ? BigInt(d['stopLoss']) : null,
    takeProfit: d['takeProfit'] ? BigInt(d['takeProfit']) : null,
    openedAt: d['openedAt'] ? new Date(d['openedAt']) : new Date(),
  });
}
