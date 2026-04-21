import { getDb } from '@exness/db';
import type { Request, Response } from 'express';
import { ApiError } from '../middleware/error.js';

export async function getBalance(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const bal = await getDb().balance.findUnique({ where: { userId } });
  if (!bal) throw new ApiError(404, 'INTERNAL_ERROR', 'balance row missing');
  // Spec shape: { usd_balance: 500000 }
  // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint cents to JSON number
  res.status(200).json({ usd_balance: Number(bal.usdBalance) });
}
