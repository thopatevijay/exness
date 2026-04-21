import { getDb } from '@exness/db';
import type { Request, Response } from 'express';
import { refreshAggregatedMetrics } from '../lib/aggregateMetrics.js';
import { platformPnlUsdCents } from '../metrics.js';

export async function getPlatformSummary(_req: Request, res: Response): Promise<void> {
  await refreshAggregatedMetrics();
  const db = getDb();
  const openCount = await db.order.count();
  const closedCount = await db.tradeHistory.count();
  const gauge = await platformPnlUsdCents.get();
  res.status(200).json({
    platformPnlUsdCents: gauge.values[0]?.value ?? 0,
    openOrders: openCount,
    closedTrades: closedCount,
  });
}
