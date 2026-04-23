import { getDb } from '@exness/db';
import { toApi } from '@exness/money';
import { ASSET_DECIMALS, CandlesQuerySchema } from '@exness/shared';
import type { Request, Response } from 'express';

const VIEW_BY_TS: Record<string, string> = {
  '1m': 'candles_1m',
  '5m': 'candles_5m',
  '15m': 'candles_15m',
  '1h': 'candles_1h',
  '1d': 'candles_1d',
  '1w': 'candles_1w',
};

export async function getCandles(req: Request, res: Response): Promise<void> {
  const q = CandlesQuerySchema.parse(req.query);
  const view = VIEW_BY_TS[q.ts]!;
  const dec = ASSET_DECIMALS[q.asset];

  const start = new Date(q.startTime);
  const end = new Date(q.endTime);

  const rows = await getDb().$queryRawUnsafe<
    {
      bucket: Date;
      open: bigint;
      high: bigint;
      low: bigint;
      close: bigint;
      volume: bigint | null;
    }[]
  >(
    `SELECT bucket, open, high, low, close, volume
       FROM ${view}
      WHERE asset = $1
        AND bucket BETWEEN $2 AND $3
      ORDER BY bucket ASC
      LIMIT 10000`,
    q.asset,
    start,
    end,
  );

  const candles = rows.map((r) => ({
    timestamp: Math.floor(r.bucket.getTime() / 1000),
    open: toApi({ value: r.open, decimals: dec }, dec).value,
    high: toApi({ value: r.high, decimals: dec }, dec).value,
    low: toApi({ value: r.low, decimals: dec }, dec).value,
    close: toApi({ value: r.close, decimals: dec }, dec).value,
    // eslint-disable-next-line no-restricted-syntax -- api boundary: qty bigint at 8dp → JSON number
    volume: r.volume !== null ? Number(r.volume) : 0,
    decimal: dec,
  }));

  res.status(200).json({ candles });
}
