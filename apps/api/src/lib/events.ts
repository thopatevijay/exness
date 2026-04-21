import type { CloseReason, OpenOrderSnapshot, Symbol } from '@exness/shared';
import type { Side } from '@exness/money';
import type { Redis } from 'ioredis';

const STREAM = 'trade_executed';
const ORDERS_CHANNEL = 'orders:events';

export async function emitOrderOpened(
  redis: Redis,
  args: {
    orderId: string;
    userId: string;
    asset: Symbol;
    side: Side;
    margin: bigint;
    leverage: number;
    openPrice: bigint;
    liquidationPrice: bigint;
    requestId: string;
  },
): Promise<void> {
  const ts = Date.now();
  await redis.xadd(
    STREAM,
    'MAXLEN', '~', '10000',
    '*',
    'type', 'order_opened',
    'orderId', args.orderId,
    'userId', args.userId,
    'asset', args.asset,
    'side', args.side,
    'margin', args.margin.toString(),
    'leverage', String(args.leverage),
    'openPrice', args.openPrice.toString(),
    'liquidationPrice', args.liquidationPrice.toString(),
    'requestId', args.requestId,
    'ts', String(ts),
  );
}

export async function emitOrderClosed(
  redis: Redis,
  args: {
    orderId: string;
    userId: string;
    asset: Symbol;
    side: Side;
    closePrice: bigint;
    pnl: bigint;
    closeReason: CloseReason;
    requestId: string;
  },
): Promise<void> {
  const ts = Date.now();
  await redis.xadd(
    STREAM,
    'MAXLEN', '~', '10000',
    '*',
    'type', 'order_closed',
    'orderId', args.orderId,
    'userId', args.userId,
    'asset', args.asset,
    'side', args.side,
    'closePrice', args.closePrice.toString(),
    'pnl', args.pnl.toString(),
    'closeReason', args.closeReason,
    'requestId', args.requestId,
    'ts', String(ts),
  );
}

export async function publishOrderAdd(redis: Redis, snapshot: OpenOrderSnapshot): Promise<void> {
  await redis.publish(
    ORDERS_CHANNEL,
    JSON.stringify({
      kind: 'add',
      order: {
        ...snapshot,
        margin: snapshot.margin.toString(),
        openPrice: snapshot.openPrice.toString(),
        liquidationPrice: snapshot.liquidationPrice.toString(),
        stopLoss: snapshot.stopLoss?.toString() ?? null,
        takeProfit: snapshot.takeProfit?.toString() ?? null,
      },
    }),
  );
}

export async function publishOrderRemove(redis: Redis, orderId: string): Promise<void> {
  await redis.publish(ORDERS_CHANNEL, JSON.stringify({ kind: 'remove', orderId }));
}
