import { getDb } from '@exness/db';
import { toApi } from '@exness/money';
import type { Symbol } from '@exness/shared';
import type { Request, Response } from 'express';
import { redis } from '../lib/redis.js';
import { getLatestPrice } from '../lib/latestPrice.js';

export async function getAssets(_req: Request, res: Response): Promise<void> {
  const rows = await getDb().asset.findMany({ where: { isActive: true } });
  const out = await Promise.all(
    rows.map(async (a) => {
      let buyPrice: number | null = null;
      let sellPrice: number | null = null;
      let ts: number | null = null;
      try {
        const latest = await getLatestPrice(redis(), a.symbol as Symbol);
        buyPrice = toApi({ value: latest.buy, decimals: a.decimals }, a.decimals).value;
        sellPrice = toApi({ value: latest.sell, decimals: a.decimals }, a.decimals).value;
        ts = latest.ts;
      } catch {
        // price unavailable; emit nulls for this asset
      }
      return {
        name: a.name,
        symbol: a.symbol,
        buyPrice,
        sellPrice,
        ts,
        decimals: a.decimals,
        imageUrl: a.imageUrl,
      };
    }),
  );
  res.status(200).json({ assets: out });
}
