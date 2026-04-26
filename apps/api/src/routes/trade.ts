import { getDb } from '@exness/db';
import { liquidationPrice, toApi, type ValidLeverage } from '@exness/money';
import { ASSET_DECIMALS, type OpenTradeInput } from '@exness/shared';
import type { Request, Response } from 'express';
import { redis } from '../lib/redis.js';
import { emitOrderOpened } from '../lib/events.js';
import { getLatestPrice, requireFresh } from '../lib/latestPrice.js';
import { ApiError } from '../middleware/error.js';
import { tradesOpenedTotal } from '../metrics.js';

export async function openTrade(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const input = req.body as OpenTradeInput;
  const decimals = ASSET_DECIMALS[input.asset];

  // 1. Latest price (already at asset's decimals). Must be fresh — we never
  // open against a stale fallback price.
  const latest = await getLatestPrice(redis(), input.asset);
  requireFresh(latest, 10_000);
  // Long opens at ASK (the higher quote). Short opens at BID (the lower quote).
  const openSidePriceBigint = input.type === 'buy' ? latest.ask : latest.bid;
  const openSidePrice = { value: openSidePriceBigint, decimals };

  // 2. Liquidation price (per side + leverage)
  const liq = liquidationPrice(input.type, openSidePrice, input.leverage as ValidLeverage);

  // 3. SL/TP come in at asset's decimals — no rescale needed.
  const stopLoss = input.stopLoss ? { value: BigInt(input.stopLoss), decimals } : null;
  const takeProfit = input.takeProfit ? { value: BigInt(input.takeProfit), decimals } : null;

  // 4. Sanity: SL/TP correct side
  if (input.type === 'buy') {
    if (stopLoss && stopLoss.value >= openSidePrice.value) {
      throw new ApiError(400, 'INVALID_INPUT', 'stopLoss must be below open price for long');
    }
    if (takeProfit && takeProfit.value <= openSidePrice.value) {
      throw new ApiError(400, 'INVALID_INPUT', 'takeProfit must be above open price for long');
    }
  } else {
    if (stopLoss && stopLoss.value <= openSidePrice.value) {
      throw new ApiError(400, 'INVALID_INPUT', 'stopLoss must be above open price for short');
    }
    if (takeProfit && takeProfit.value >= openSidePrice.value) {
      throw new ApiError(400, 'INVALID_INPUT', 'takeProfit must be below open price for short');
    }
  }

  const db = getDb();
  const orderId = await db.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<{ usd_balance: bigint }[]>(
      `SELECT usd_balance FROM balances WHERE user_id = $1::uuid FOR UPDATE`,
      userId,
    );
    if (rows.length === 0) throw new ApiError(500, 'INTERNAL_ERROR', 'no balance row');
    const balance = rows[0]!.usd_balance;
    const lockedRows = await tx.$queryRawUnsafe<{ locked: bigint | null }[]>(
      `SELECT COALESCE(SUM(margin), 0)::bigint AS locked FROM orders WHERE user_id = $1::uuid`,
      userId,
    );
    const lockedMargin = lockedRows[0]?.locked ?? 0n;
    const freeMargin = balance - lockedMargin;
    if (freeMargin < BigInt(input.margin)) {
      throw new ApiError(400, 'INSUFFICIENT_BALANCE', 'free margin below requested margin');
    }
    const inserted = await tx.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO orders (user_id, asset, side, margin, leverage, open_price, stop_loss, take_profit, liquidation_price)
       VALUES ($1::uuid, $2, $3, $4::bigint, $5::smallint, $6::bigint, $7::bigint, $8::bigint, $9::bigint)
       RETURNING id`,
      userId,
      input.asset,
      input.type,
      input.margin,
      input.leverage,
      openSidePrice.value,
      stopLoss?.value ?? null,
      takeProfit?.value ?? null,
      liq.value,
    );
    return inserted[0]!.id;
  });

  // 6. Fire event after commit — stream carries the full snapshot so
  //    liquidation-worker's cg:liq-index consumer can hydrate its index
  //    without a DB lookup.
  await emitOrderOpened(redis(), {
    orderId,
    userId,
    asset: input.asset,
    side: input.type,
    margin: BigInt(input.margin),
    leverage: input.leverage,
    openPrice: openSidePrice.value,
    liquidationPrice: liq.value,
    stopLoss: stopLoss?.value ?? null,
    takeProfit: takeProfit?.value ?? null,
    requestId: req.requestId,
  });

  tradesOpenedTotal.inc({ asset: input.asset, side: input.type, leverage: String(input.leverage) });

  res.status(200).json({
    orderId,
    openPrice: toApi(openSidePrice, decimals).value,
    liquidationPrice: toApi(liq, decimals).value,
    decimals,
  });
}
