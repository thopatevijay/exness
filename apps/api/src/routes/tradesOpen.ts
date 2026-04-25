import { getDb } from '@exness/db';
import { exposure, pnl, toApi, type Side, type ValidLeverage } from '@exness/money';
import { ASSET_DECIMALS, type Symbol } from '@exness/shared';
import type { Request, Response } from 'express';
import { redis } from '../lib/redis.js';
import { getLatestPrice } from '../lib/latestPrice.js';

export async function getOpenTrades(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const orders = await getDb().order.findMany({
    where: { userId },
    orderBy: { openedAt: 'desc' },
  });

  const out = await Promise.all(
    orders.map(async (o) => {
      const asset = o.asset as Symbol;
      const side = o.side as Side;
      const dec = ASSET_DECIMALS[asset];
      let unrealizedPnl = 0;
      try {
        const latest = await getLatestPrice(redis(), asset);
        const exit = { value: side === 'buy' ? latest.bid : latest.ask, decimals: dec };
        const exp = exposure({ value: o.margin, decimals: 2 }, o.leverage as ValidLeverage);
        const open = { value: o.openPrice, decimals: dec };
        // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint cents to JSON number
        unrealizedPnl = Number(pnl(side, exp, open, exit).value);
      } catch {
        unrealizedPnl = 0;
      }
      return {
        orderId: o.id,
        asset,
        type: side,
        // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint cents to JSON number
        margin: Number(o.margin),
        leverage: o.leverage,
        openPrice: toApi({ value: o.openPrice, decimals: dec }, dec).value,
        stopLoss: o.stopLoss ? toApi({ value: o.stopLoss, decimals: dec }, dec).value : null,
        takeProfit: o.takeProfit ? toApi({ value: o.takeProfit, decimals: dec }, dec).value : null,
        liquidationPrice: toApi({ value: o.liquidationPrice, decimals: dec }, dec).value,
        unrealizedPnl,
        decimals: dec,
        openedAt: o.openedAt.toISOString(),
      };
    }),
  );

  res.status(200).json({ trades: out });
}
