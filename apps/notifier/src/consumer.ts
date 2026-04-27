import { ensureGroup, readGroup, type StreamEntry } from '@exness/bus';
import { getDb } from '@exness/db';
import { logger } from '@exness/logger';
import type { CloseReason, Symbol } from '@exness/shared';
import type { Redis } from 'ioredis';
import { send } from './send.js';
import { orderClosed } from './templates/orderClosed.js';
import { orderOpened } from './templates/orderOpened.js';
import { userDeposit } from './templates/userDeposit.js';
import { userReset } from './templates/userReset.js';

const TRADE_STREAM = 'trade_executed';
const USER_STREAM = 'user_events';
const GROUP = 'cg:notifier';
const CONSUMER = process.env['HOSTNAME'] ?? 'notifier';
const READ_COUNT = 50;
const BLOCK_MS = 1_000;
const DEDUP_TTL_SEC = 24 * 60 * 60;

export async function startConsumer(redis: Redis): Promise<void> {
  await ensureGroup(redis, TRADE_STREAM, GROUP);
  await ensureGroup(redis, USER_STREAM, GROUP);
  void loop(redis, TRADE_STREAM, handleTradeEntry);
  void loop(redis, USER_STREAM, handleUserEntry);
}

type Handler = (redis: Redis, entry: StreamEntry) => Promise<void>;

async function loop(redis: Redis, stream: string, handler: Handler): Promise<void> {
  while (true) {
    try {
      const entries = await readGroup(redis, GROUP, CONSUMER, [stream], READ_COUNT, BLOCK_MS);
      for (const e of entries) {
        try {
          await handler(redis, e);
        } catch (err) {
          logger.error({ err, id: e.id, stream }, 'notifier handler failed');
        }
        await redis.xack(stream, GROUP, e.id);
      }
    } catch (err) {
      logger.error({ err, stream }, 'notifier readGroup failed; backing off 1s');
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }
}

async function alreadySent(redis: Redis, key: string): Promise<boolean> {
  const set = await redis.set(`notifier:${key}`, '1', 'EX', DEDUP_TTL_SEC, 'NX');
  return set === null;
}

async function lookupEmail(userId: string): Promise<string | null> {
  const u = await getDb().user.findUnique({ where: { id: userId }, select: { email: true } });
  return u?.email ?? null;
}

async function handleTradeEntry(redis: Redis, entry: StreamEntry): Promise<void> {
  const type = entry.data['type'];
  const userId = entry.data['userId'];
  if (!type || !userId) return;
  if (await alreadySent(redis, entry.id)) return;
  const email = await lookupEmail(userId);
  if (!email) return;

  if (type === 'order_opened') {
    const tpl = orderOpened({
      asset: entry.data['asset'] as Symbol,
      side: entry.data['side'] as 'buy' | 'sell',
      marginCents: BigInt(entry.data['margin'] ?? '0'),
      // eslint-disable-next-line no-restricted-syntax -- stream wire format: int string
      leverage: parseInt(entry.data['leverage'] ?? '1', 10),
      openPrice: BigInt(entry.data['openPrice'] ?? '0'),
      orderId: entry.data['orderId'] ?? '',
    });
    await send({ to: email, ...tpl });
  } else if (type === 'order_closed') {
    const tpl = orderClosed({
      asset: entry.data['asset'] as Symbol,
      side: entry.data['side'] as 'buy' | 'sell',
      closePrice: BigInt(entry.data['closePrice'] ?? '0'),
      pnlCents: BigInt(entry.data['pnl'] ?? '0'),
      reason: (entry.data['closeReason'] as CloseReason) ?? 'manual',
      orderId: entry.data['orderId'] ?? '',
    });
    await send({ to: email, ...tpl });
  }
  // order_modified: silent — no email needed for SL/TP edits
}

async function handleUserEntry(redis: Redis, entry: StreamEntry): Promise<void> {
  const type = entry.data['type'];
  const userId = entry.data['userId'];
  if (!type || !userId) return;
  if (await alreadySent(redis, entry.id)) return;
  const email = await lookupEmail(userId);
  if (!email) return;

  if (type === 'user_deposit') {
    const tpl = userDeposit({
      amountCents: BigInt(entry.data['amount'] ?? '0'),
      newBalanceCents: BigInt(entry.data['newBalance'] ?? '0'),
    });
    await send({ to: email, ...tpl });
  } else if (type === 'user_reset') {
    const tpl = userReset({
      newBalanceCents: BigInt(entry.data['newBalance'] ?? '0'),
      // eslint-disable-next-line no-restricted-syntax -- stream wire format: int string
      ordersClosed: parseInt(entry.data['ordersClosed'] ?? '0', 10),
      // eslint-disable-next-line no-restricted-syntax -- stream wire format: int string
      historyDeleted: parseInt(entry.data['historyDeleted'] ?? '0', 10),
    });
    await send({ to: email, ...tpl });
  }
}
