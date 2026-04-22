import { getDb } from '@exness/db';
import { INITIAL_BALANCE } from '@exness/money';
import type { Request, Response } from 'express';
import { publishOrderRemove } from '../lib/events.js';
import { redis } from '../lib/redis.js';

export async function resetDemo(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const db = getDb();

  const deletedIds: string[] = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<{ id: string }[]>(
      'DELETE FROM orders WHERE user_id = $1::uuid RETURNING id',
      userId,
    );
    await tx.$executeRawUnsafe('DELETE FROM trade_history WHERE user_id = $1::uuid', userId);
    await tx.$executeRawUnsafe(
      'UPDATE balances SET usd_balance = $1::bigint, updated_at = now() WHERE user_id = $2::uuid',
      INITIAL_BALANCE.value.toString(),
      userId,
    );
    return rows.map((r) => r.id);
  });

  const r = redis();
  for (const id of deletedIds) {
    await publishOrderRemove(r, id);
  }

  res.status(200).json({
    ok: true,
    // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint cents → number
    usd_balance: Number(INITIAL_BALANCE.value),
    removedOrders: deletedIds.length,
  });
}
