import { getDb } from '@exness/db';
import { ASSET_DECIMALS, type ModifyTradeInput, type Symbol } from '@exness/shared';
import type { Side } from '@exness/money';
import type { Request, Response } from 'express';
import { emitOrderModified, publishOrderModify } from '../lib/events.js';
import { redis } from '../lib/redis.js';
import { ApiError } from '../middleware/error.js';

export async function modifyTrade(req: Request, res: Response): Promise<void> {
  const userId = req.userId!;
  const orderId = typeof req.params['id'] === 'string' ? req.params['id'] : undefined;
  if (!orderId) throw new ApiError(400, 'INVALID_INPUT', 'missing order id');
  const input = req.body as ModifyTradeInput;

  const db = getDb();
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', 'order not found');
  }

  const side = order.side as Side;
  const openPrice = order.openPrice;

  if (input.stopLoss !== undefined && input.stopLoss !== null) {
    const sl = BigInt(input.stopLoss);
    if (side === 'buy' && sl >= openPrice) {
      throw new ApiError(400, 'INVALID_INPUT', 'stopLoss must be below open price for long');
    }
    if (side === 'sell' && sl <= openPrice) {
      throw new ApiError(400, 'INVALID_INPUT', 'stopLoss must be above open price for short');
    }
  }
  if (input.takeProfit !== undefined && input.takeProfit !== null) {
    const tp = BigInt(input.takeProfit);
    if (side === 'buy' && tp <= openPrice) {
      throw new ApiError(400, 'INVALID_INPUT', 'takeProfit must be above open price for long');
    }
    if (side === 'sell' && tp >= openPrice) {
      throw new ApiError(400, 'INVALID_INPUT', 'takeProfit must be below open price for short');
    }
  }

  const sets: string[] = [];
  const params: (number | null)[] = [];
  let i = 1;
  if (input.stopLoss !== undefined) {
    sets.push(`stop_loss = $${i}::bigint`);
    params.push(input.stopLoss);
    i += 1;
  }
  if (input.takeProfit !== undefined) {
    sets.push(`take_profit = $${i}::bigint`);
    params.push(input.takeProfit);
    i += 1;
  }
  await db.$executeRawUnsafe(
    `UPDATE orders SET ${sets.join(', ')} WHERE id = $${i}::uuid`,
    ...params,
    orderId,
  );

  const updated = await db.order.findUnique({ where: { id: orderId } });
  if (!updated) throw new ApiError(500, 'INTERNAL_ERROR', 'updated order vanished');

  await emitOrderModified(redis(), {
    orderId,
    userId,
    asset: order.asset as Symbol,
    side,
    stopLoss: updated.stopLoss,
    takeProfit: updated.takeProfit,
    requestId: req.requestId,
  });
  await publishOrderModify(redis(), {
    orderId,
    userId,
    asset: order.asset as Symbol,
    side,
    margin: updated.margin,
    leverage: updated.leverage,
    openPrice: updated.openPrice,
    liquidationPrice: updated.liquidationPrice,
    stopLoss: updated.stopLoss,
    takeProfit: updated.takeProfit,
    openedAt: updated.openedAt,
  });

  const decimals = ASSET_DECIMALS[order.asset as Symbol];
  res.status(200).json({
    orderId,
    // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint → number
    stopLoss: updated.stopLoss !== null ? Number(updated.stopLoss) : null,
    // eslint-disable-next-line no-restricted-syntax -- api boundary: bigint → number
    takeProfit: updated.takeProfit !== null ? Number(updated.takeProfit) : null,
    decimals,
  });
}
