import { getDb } from '@exness/db';
import type { Request, Response } from 'express';
import { ApiError } from '../middleware/error.js';

export async function getMe(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const db = getDb();
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, createdAt: true },
  });
  if (!u) throw new ApiError(404, 'INTERNAL_ERROR', 'user missing');

  const [openCount, closedCount] = await Promise.all([
    db.order.count({ where: { userId } }),
    db.tradeHistory.count({ where: { userId } }),
  ]);

  const realizedRow = await db.$queryRawUnsafe<{ s: bigint }[]>(
    'SELECT COALESCE(SUM(pnl),0)::bigint AS s FROM trade_history WHERE user_id = $1::uuid',
    userId,
  );
  const realizedCents = realizedRow[0]?.s ?? 0n;

  res.status(200).json({
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    openCount,
    closedCount,
    // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint cents → number
    realizedCents: Number(realizedCents),
  });
}
