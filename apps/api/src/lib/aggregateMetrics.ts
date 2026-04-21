import { getDb } from '@exness/db';
import { exposure, pnl, type Side, type ValidLeverage } from '@exness/money';
import { ASSET_DECIMALS, SYMBOLS, type Symbol } from '@exness/shared';
import { Gauge } from 'prom-client';
import { redis } from './redis.js';
import { openOrdersCount, platformPnlUsdCents, registry } from '../metrics.js';

const binanceFeedStaleMs = new Gauge({
  name: 'binance_feed_stale_ms',
  help: 'Milliseconds since last Binance tick per asset',
  labelNames: ['asset'],
  registers: [registry],
});

const wsActiveConnections = new Gauge({
  name: 'ws_active_connections',
  help: 'Active WebSocket connections',
  registers: [registry],
});

const ticksInsertedTotal = new Gauge({
  name: 'ticks_inserted_total_redis',
  help: 'Cumulative ticks inserted by batch-uploader (snapshot)',
  registers: [registry],
});

const liquidationIndexSize = new Gauge({
  name: 'liquidation_index_size',
  help: 'Open orders tracked by liquidation-worker',
  registers: [registry],
});

const reconcilerDriftTotal = new Gauge({
  name: 'reconciler_drift_total',
  help: 'Total drift events repaired by reconciler',
  registers: [registry],
});

// eslint-disable-next-line no-restricted-syntax -- metrics boundary: string → number for Gauge
const toN = (v: string | null | undefined): number => Number(v ?? 0);

export async function refreshAggregatedMetrics(): Promise<void> {
  const r = redis();
  const db = getDb();

  // Per-asset feed staleness
  const lastTickHash = await r.hgetall('metrics:poller:lastTickTs');
  const now = Date.now();
  for (const sym of SYMBOLS) {
    const ts = toN(lastTickHash[sym]);
    binanceFeedStaleMs.labels(sym).set(ts > 0 ? now - ts : Number.POSITIVE_INFINITY);
  }

  // ws-server connections
  wsActiveConnections.set(toN(await r.get('metrics:ws:conns')));

  // batch-uploader inserts
  ticksInsertedTotal.set(toN(await r.hget('metrics:uploader', 'ticksInsertedTotal')));

  // liquidation worker
  liquidationIndexSize.set(toN(await r.get('metrics:liq:indexSize')));
  reconcilerDriftTotal.set(toN(await r.get('metrics:liq:driftTotal')));

  // Open orders count + platform PnL
  const orders = await db.order.findMany();
  const counts = new Map<Symbol, number>();
  for (const o of orders) {
    counts.set(o.asset as Symbol, (counts.get(o.asset as Symbol) ?? 0) + 1);
  }
  for (const sym of SYMBOLS) openOrdersCount.labels(sym).set(counts.get(sym) ?? 0);

  // Realized PnL sum from closed trades
  const realizedRow = await db.$queryRawUnsafe<{ s: bigint }[]>(
    'SELECT COALESCE(SUM(pnl),0)::bigint AS s FROM trade_history',
  );
  const realized = realizedRow[0]?.s ?? 0n;

  // Unrealized PnL from open positions against latest prices
  let unrealized = 0n;
  for (const o of orders) {
    const sym = o.asset as Symbol;
    const dec = ASSET_DECIMALS[sym];
    const latestRaw = await r.get(`latest:${sym}`);
    if (!latestRaw) continue;
    const latest = JSON.parse(latestRaw) as { buy: string; sell: string };
    const exit = {
      value: o.side === 'buy' ? BigInt(latest.sell) : BigInt(latest.buy),
      decimals: dec,
    };
    const exp = exposure({ value: o.margin, decimals: 2 }, o.leverage as ValidLeverage);
    const open = { value: o.openPrice, decimals: dec };
    unrealized += pnl(o.side as Side, exp, open, exit).value;
  }
  // Platform PnL is the inverse (house wins what users lose)
  // eslint-disable-next-line no-restricted-syntax -- metrics boundary: bigint cents to Gauge number
  platformPnlUsdCents.set(Number(-(realized + unrealized)));
}
