import type { CloseReason, Symbol } from '@exness/shared';
import type { Side } from '@exness/money';
import type { Redis } from 'ioredis';

const STREAM = 'trade_executed';
const USER_STREAM = 'user_events';

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
    stopLoss?: bigint | null;
    takeProfit?: bigint | null;
    openedAt?: Date;
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
    'stopLoss', args.stopLoss?.toString() ?? '',
    'takeProfit', args.takeProfit?.toString() ?? '',
    'openedAt', args.openedAt?.toISOString() ?? '',
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

export async function emitUserDeposit(
  redis: Redis,
  args: {
    userId: string;
    amount: bigint;
    newBalance: bigint;
    requestId: string;
  },
): Promise<void> {
  await redis.xadd(
    USER_STREAM,
    'MAXLEN', '~', '5000',
    '*',
    'type', 'user_deposit',
    'userId', args.userId,
    'amount', args.amount.toString(),
    'newBalance', args.newBalance.toString(),
    'requestId', args.requestId,
    'ts', String(Date.now()),
  );
}

export async function emitUserReset(
  redis: Redis,
  args: {
    userId: string;
    newBalance: bigint;
    ordersClosed: number;
    historyDeleted: number;
    requestId: string;
  },
): Promise<void> {
  await redis.xadd(
    USER_STREAM,
    'MAXLEN', '~', '5000',
    '*',
    'type', 'user_reset',
    'userId', args.userId,
    'newBalance', args.newBalance.toString(),
    'ordersClosed', String(args.ordersClosed),
    'historyDeleted', String(args.historyDeleted),
    'requestId', args.requestId,
    'ts', String(Date.now()),
  );
}

export async function emitOrderModified(
  redis: Redis,
  args: {
    orderId: string;
    userId: string;
    asset: Symbol;
    side: Side;
    // Full snapshot so a stream-only consumer (e.g. liquidation-worker's
    // cg:liq-index) can rebuild an index entry without a DB lookup.
    margin: bigint;
    leverage: number;
    openPrice: bigint;
    liquidationPrice: bigint;
    stopLoss: bigint | null;
    takeProfit: bigint | null;
    openedAt: Date;
    requestId: string;
  },
): Promise<void> {
  const ts = Date.now();
  await redis.xadd(
    STREAM,
    'MAXLEN', '~', '10000',
    '*',
    'type', 'order_modified',
    'orderId', args.orderId,
    'userId', args.userId,
    'asset', args.asset,
    'side', args.side,
    'margin', args.margin.toString(),
    'leverage', String(args.leverage),
    'openPrice', args.openPrice.toString(),
    'liquidationPrice', args.liquidationPrice.toString(),
    'stopLoss', args.stopLoss?.toString() ?? '',
    'takeProfit', args.takeProfit?.toString() ?? '',
    'openedAt', args.openedAt.toISOString(),
    'requestId', args.requestId,
    'ts', String(ts),
  );
}
