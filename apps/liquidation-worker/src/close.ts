import { getDb } from '@exness/db';
import {
  exposure,
  max as maxAmount,
  negate,
  pnl,
  type Side,
  type ValidLeverage,
} from '@exness/money';
import { ASSET_DECIMALS, type CloseReason } from '@exness/shared';
import { logger } from '@exness/logger';
import type { Redis } from 'ioredis';
import type { IndexedOrder } from './index_.js';

const STREAM = 'trade_executed';

export async function closeOrder(
  redis: Redis,
  order: IndexedOrder,
  exitValue: bigint, // bigint at the asset's decimals (ASSET_DECIMALS[order.asset])
  reason: CloseReason,
): Promise<boolean> {
  const dec = ASSET_DECIMALS[order.asset];
  const exit = { value: exitValue, decimals: dec };
  const margin = { value: order.margin, decimals: 2 };
  const exposureUsd = exposure(margin, order.leverage as ValidLeverage);
  const open = { value: order.openPrice, decimals: dec };
  let pnlAmt = pnl(order.side as Side, exposureUsd, open, exit);
  if (reason === 'liquidation') {
    // Clamp PnL to -margin so user never owes more than posted margin.
    pnlAmt = maxAmount(pnlAmt, negate(margin));
  }

  const db = getDb();
  const wonRace = await db.$transaction(async (tx) => {
    const deleted = await tx.$queryRawUnsafe<{ id: string }[]>(
      `DELETE FROM orders WHERE id = $1::uuid AND user_id = $2::uuid RETURNING id`,
      order.orderId,
      order.userId,
    );
    if (deleted.length === 0) return false; // someone else won the close race
    await tx.$executeRawUnsafe(
      `UPDATE balances SET usd_balance = usd_balance + $1::bigint, updated_at = now() WHERE user_id = $2::uuid`,
      pnlAmt.value,
      order.userId,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO trade_history
         (id, user_id, asset, side, margin, leverage, open_price, close_price, pnl, close_reason, opened_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::bigint, $6::smallint, $7::bigint, $8::bigint, $9::bigint, $10, $11)`,
      order.orderId,
      order.userId,
      order.asset,
      order.side,
      order.margin,
      order.leverage,
      order.openPrice,
      exit.value,
      pnlAmt.value,
      reason,
      order.openedAt,
    );
    return true;
  });

  if (!wonRace) {
    logger.info({ orderId: order.orderId, reason }, 'lost close race; peer already closed');
    return false;
  }

  // Emit to trade_executed for ws-server fanout. The evaluator already removed
  // the order from the in-process index optimistically, and our own
  // cg:liq-index consumer will also see this order_closed (idempotent).
  await redis.xadd(
    STREAM, 'MAXLEN', '~', '10000', '*',
    'type', 'order_closed',
    'orderId', order.orderId,
    'userId', order.userId,
    'asset', order.asset,
    'side', order.side,
    'closePrice', exit.value.toString(),
    'pnl', pnlAmt.value.toString(),
    'closeReason', reason,
    'ts', String(Date.now()),
  );

  logger.info(
    { orderId: order.orderId, reason, pnl: pnlAmt.value.toString(), userId: order.userId },
    'order closed by liquidation-worker',
  );
  return true;
}
