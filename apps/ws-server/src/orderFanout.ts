import { ensureGroup, readGroup } from '@exness/bus';
import type { Redis } from 'ioredis';
import type { SubscriptionRegistry } from './subscriptions.js';

const STREAM = 'trade_executed';
const GROUP = 'cg:ws';
// Stable consumer name — pid-suffixed names would leak PEL entries on every restart.
const CONSUMER = process.env.HOSTNAME ?? 'ws-server';

export async function startOrderFanout(redis: Redis, reg: SubscriptionRegistry): Promise<void> {
  await ensureGroup(redis, STREAM, GROUP);

  while (true) {
    const entries = await readGroup(redis, GROUP, CONSUMER, [STREAM], 50, 1_000);
    for (const e of entries) {
      const userId = e.data['userId'];
      const type = e.data['type'];

      if (!userId || userId.startsWith('guest:')) {
        await redis.xack(STREAM, GROUP, e.id);
        continue;
      }

      const event =
        type === 'order_opened' ? 'opened' : type === 'order_modified' ? 'modified' : 'closed';
      const slRaw = e.data['stopLoss'];
      const tpRaw = e.data['takeProfit'];
      const frame = JSON.stringify({
        type: 'order_update',
        event,
        orderId: e.data['orderId'],
        closeReason: e.data['closeReason'] ?? null,
        // eslint-disable-next-line no-restricted-syntax -- api boundary: stream string to JSON number
        pnl: e.data['pnl'] ? Number(e.data['pnl']) : null,
        // eslint-disable-next-line no-restricted-syntax -- api boundary: stream string to JSON number
        stopLoss: slRaw ? Number(slRaw) : null,
        // eslint-disable-next-line no-restricted-syntax -- api boundary: stream string to JSON number
        takeProfit: tpRaw ? Number(tpRaw) : null,
        requestId: e.data['requestId'] ?? null,
      });

      const sockets = reg.socketsForUser(userId);
      if (sockets) {
        for (const ws of sockets) {
          ws.send(frame);
        }
      }
      await redis.xack(STREAM, GROUP, e.id);
    }
  }
}
