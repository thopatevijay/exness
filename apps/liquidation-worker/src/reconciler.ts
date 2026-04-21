import { getDb } from '@exness/db';
import { logger } from '@exness/logger';
import type { Side } from '@exness/money';
import { SYMBOLS, type Symbol } from '@exness/shared';
import type { OrderIndex, IndexedOrder } from './index_.js';

const RECONCILE_MS = 30_000;

let driftCounter = 0;
export function getDriftCount(): number {
  return driftCounter;
}

export async function rebuildIndex(index: OrderIndex): Promise<void> {
  index.clear();
  const rows = await getDb().order.findMany();
  for (const r of rows) {
    index.add(toIndexed(r));
  }
  logger.info({ count: index.size() }, 'index rebuilt from db');
}

export function startReconciler(index: OrderIndex): void {
  setInterval(async () => {
    try {
      const rows = await getDb().order.findMany();
      const dbIds = new Set(rows.map((r) => r.id));
      let drift = 0;

      // Add anything in DB but not in index
      for (const r of rows) {
        if (!index.has(r.id)) {
          index.add(toIndexed(r));
          drift++;
        }
      }
      // Remove anything in index but not in DB
      for (const ord of allInIndex(index)) {
        if (!dbIds.has(ord.orderId)) {
          index.remove(ord.orderId);
          drift++;
        }
      }
      if (drift > 0) {
        driftCounter += drift;
        logger.warn({ drift, total: driftCounter }, 'reconciler repaired drift');
      }
    } catch (err) {
      logger.error({ err }, 'reconciler failed');
    }
  }, RECONCILE_MS);
}

function* allInIndex(index: OrderIndex): IterableIterator<IndexedOrder> {
  for (const s of SYMBOLS) {
    for (const o of index.iterate(s, 'buy')) yield o;
    for (const o of index.iterate(s, 'sell')) yield o;
  }
}

function toIndexed(r: {
  id: string;
  userId: string;
  asset: string;
  side: string;
  margin: bigint;
  leverage: number;
  openPrice: bigint;
  liquidationPrice: bigint;
  stopLoss: bigint | null;
  takeProfit: bigint | null;
  openedAt: Date;
}): IndexedOrder {
  return {
    orderId: r.id,
    userId: r.userId,
    asset: r.asset as Symbol,
    side: r.side as Side,
    margin: r.margin,
    leverage: r.leverage,
    openPrice: r.openPrice,
    liquidationPrice: r.liquidationPrice,
    stopLoss: r.stopLoss,
    takeProfit: r.takeProfit,
    openedAt: r.openedAt,
  };
}
