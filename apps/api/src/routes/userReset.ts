import { getDb } from '@exness/db';
import { INITIAL_BALANCE } from '@exness/money';
import type { Request, Response } from 'express';
import { emitUserReset } from '../lib/events.js';
import { redis } from '../lib/redis.js';

export async function resetDemo(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const db = getDb();

  const result = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<{ id: string }[]>(
      'DELETE FROM orders WHERE user_id = $1::uuid RETURNING id',
      userId,
    );
    const deletedHistory = await tx.$executeRawUnsafe(
      'DELETE FROM trade_history WHERE user_id = $1::uuid',
      userId,
    );
    await tx.$executeRawUnsafe(
      'UPDATE balances SET usd_balance = $1::bigint, updated_at = now() WHERE user_id = $2::uuid',
      INITIAL_BALANCE.value.toString(),
      userId,
    );
    // eslint-disable-next-line no-restricted-syntax -- prisma raw count: rowsAffected as bigint-or-number → number for telemetry
    return { deletedOrders: rows.length, deletedHistory: Number(deletedHistory) };
  });

  await emitUserReset(redis(), {
    userId,
    newBalance: INITIAL_BALANCE.value,
    ordersClosed: result.deletedOrders,
    historyDeleted: result.deletedHistory,
    requestId: req.requestId,
  });

  res.status(200).json({
    ok: true,
    // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint cents → number
    usd_balance: Number(INITIAL_BALANCE.value),
    removedOrders: result.deletedOrders,
  });
}
