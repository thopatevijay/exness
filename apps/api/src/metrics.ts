import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestDurationMs = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request latency in ms',
  labelNames: ['route', 'method', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  registers: [registry],
});

export const tradesOpenedTotal = new Counter({
  name: 'trades_opened_total',
  help: 'Cumulative opened positions',
  labelNames: ['asset', 'side', 'leverage'],
  registers: [registry],
});

export const tradesClosedTotal = new Counter({
  name: 'trades_closed_total',
  help: 'Cumulative closed positions',
  labelNames: ['asset', 'reason'],
  registers: [registry],
});

export const platformPnlUsdCents = new Gauge({
  name: 'platform_pnl_usd_cents',
  help: 'Inverse of sum(user PnL). Positive = house profit.',
  registers: [registry],
});

export const openOrdersCount = new Gauge({
  name: 'open_orders_count',
  help: 'Number of open positions',
  labelNames: ['asset'],
  registers: [registry],
});
