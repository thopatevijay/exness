import { getDb } from '@exness/db';
import { toApi } from '@exness/money';
import { ASSET_DECIMALS, type Symbol } from '@exness/shared';
import type { Request, Response } from 'express';

export async function getClosedTrades(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  // eslint-disable-next-line no-restricted-syntax -- api boundary: query string to pagination limit
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const cursor = (req.query.cursor as string | undefined) ?? null;

  // Keyset pagination by (closedAt desc, id desc)
  const where: { userId: string; closedAt?: { lt: Date } } = { userId };
  if (cursor) {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString()) as { closedAt: string };
      where.closedAt = { lt: new Date(parsed.closedAt) };
    } catch {
      // ignore bad cursor
    }
  }

  const rows = await getDb().tradeHistory.findMany({
    where,
    orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });

  const trades = rows.map((r) => {
    const asset = r.asset as Symbol;
    const dec = ASSET_DECIMALS[asset];
    return {
      orderId: r.id,
      asset,
      type: r.side,
      // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint cents to JSON number
      margin: Number(r.margin),
      leverage: r.leverage,
      openPrice: toApi({ value: r.openPrice, decimals: dec }, dec).value,
      closePrice: toApi({ value: r.closePrice, decimals: dec }, dec).value,
      // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint cents to JSON number
      pnl: Number(r.pnl),
      closeReason: r.closeReason,
      decimals: dec,
      openedAt: r.openedAt.toISOString(),
      closedAt: r.closedAt.toISOString(),
    };
  });

  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === limit && last
      ? Buffer.from(JSON.stringify({ closedAt: last.closedAt.toISOString() })).toString('base64')
      : null;

  res.status(200).json({ trades, nextCursor });
}
