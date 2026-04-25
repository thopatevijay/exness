import { getDb } from '@exness/db';
import { add, exposure, pnl, toApi, type Side, type ValidLeverage } from '@exness/money';
import { ASSET_DECIMALS, type CloseReason, type Symbol } from '@exness/shared';
import type { Request, Response } from 'express';
import { redis } from '../lib/redis.js';
import { emitOrderClosed } from '../lib/events.js';
import { getLatestPrice, requireFresh } from '../lib/latestPrice.js';
import { ApiError } from '../middleware/error.js';
import { tradesClosedTotal } from '../metrics.js';

const REASON: CloseReason = 'manual';

export async function closeTrade(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const orderIdParam = req.params.id;
  const orderId = typeof orderIdParam === 'string' ? orderIdParam : undefined;
  if (!orderId) throw new ApiError(400, 'INVALID_INPUT', 'missing order id');

  const db = getDb();
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) {
    // Distinguish "already closed" (exists in trade_history) from "never existed".
    const closed = await db.tradeHistory.findUnique({ where: { id: orderId } });
    if (closed && closed.userId === userId) {
      throw new ApiError(409, 'ORDER_ALREADY_CLOSED', 'order already closed');
    }
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'order not found');
  }

  const asset = order.asset as Symbol;
  const side = order.side as Side;
  const decimals = ASSET_DECIMALS[asset];

  const latest = await getLatestPrice(redis(), asset);
  // Close must also settle against a fresh price — stale fallback would
  // distort the realized PnL that goes into the DB and the user's history.
  requireFresh(latest, 10_000);
  // Long closes at BID (sells back at the lower quote). Short closes at ASK.
  const exitPrice = {
    value: side === 'buy' ? latest.bid : latest.ask,
    decimals,
  };

  const margin = { value: order.margin, decimals: 2 };
  const exposureUsd = exposure(margin, order.leverage as ValidLeverage);
  const open = { value: order.openPrice, decimals };
  const pnlAmt = pnl(side, exposureUsd, open, exitPrice);
  const credit = add(margin, pnlAmt);

  const closed = await db.$transaction(async (tx) => {
    const deleted = await tx.$queryRawUnsafe<{ id: string }[]>(
      `DELETE FROM orders WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id`,
      orderId,
      userId,
    );
    if (deleted.length === 0) return null;
    await tx.$executeRawUnsafe(
      `UPDATE balances SET usd_balance = usd_balance + $1::bigint, updated_at = now() WHERE user_id = $2::uuid`,
      credit.value,
      userId,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO trade_history
         (id, user_id, asset, side, margin, leverage, open_price, close_price, pnl, close_reason, opened_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::bigint, $6::smallint, $7::bigint, $8::bigint, $9::bigint, $10, $11)`,
      orderId,
      userId,
      asset,
      side,
      order.margin,
      order.leverage,
      order.openPrice,
      exitPrice.value,
      pnlAmt.value,
      REASON,
      order.openedAt,
    );
    return true;
  });

  if (!closed) throw new ApiError(409, 'ORDER_ALREADY_CLOSED', 'order already closed');

  await emitOrderClosed(redis(), {
    orderId,
    userId,
    asset,
    side,
    closePrice: exitPrice.value,
    pnl: pnlAmt.value,
    closeReason: REASON,
    requestId: req.requestId,
  });
  tradesClosedTotal.inc({ asset, reason: REASON });

  const bal = await db.balance.findUnique({ where: { userId } });
  res.status(200).json({
    orderId,
    closePrice: toApi(exitPrice, decimals).value,
    // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint cents to JSON number
    pnl: Number(pnlAmt.value),
    closeReason: REASON,
    decimals,
    // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint cents to JSON number
    balance: Number(bal!.usdBalance),
  });
}
