import { getDb } from '@exness/db';
import { INITIAL_BALANCE } from '@exness/money';
import type { Request, Response } from 'express';
import { emitUserDeposit } from '../lib/events.js';
import { redis } from '../lib/redis.js';
import { ApiError } from '../middleware/error.js';

export async function deposit(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const db = getDb();
  await db.$executeRawUnsafe(
    'UPDATE balances SET usd_balance = usd_balance + $1::bigint, updated_at = now() WHERE user_id = $2::uuid',
    INITIAL_BALANCE.value.toString(),
    userId,
  );
  const bal = await db.balance.findUnique({ where: { userId } });
  if (!bal) throw new ApiError(404, 'INTERNAL_ERROR', 'balance row missing');

  await emitUserDeposit(redis(), {
    userId,
    amount: INITIAL_BALANCE.value,
    newBalance: bal.usdBalance,
    requestId: req.requestId,
  });

  res.status(200).json({
    // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint cents → number
    usd_balance: Number(bal.usdBalance),
    // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint cents → number
    added: Number(INITIAL_BALANCE.value),
  });
}
