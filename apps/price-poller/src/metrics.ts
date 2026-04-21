import type { Redis } from 'ioredis';

let redis: Redis | undefined;
let lastTickPerSymbol = new Map<string, { ts: number; count: number; latencySumMs: number }>();

export function initMetrics(r: Redis): void {
  redis = r;
  setInterval(flush, 5_000);
}

export function recordTick(sym: string, binanceTs: number): void {
  const now = Date.now();
  const cur = lastTickPerSymbol.get(sym) ?? { ts: 0, count: 0, latencySumMs: 0 };
  cur.ts = now;
  cur.count += 1;
  cur.latencySumMs += now - binanceTs;
  lastTickPerSymbol.set(sym, cur);
}

async function flush(): Promise<void> {
  if (!redis) return;
  const snapshot = lastTickPerSymbol;
  lastTickPerSymbol = new Map();
  for (const [sym, m] of snapshot) {
    const avgLatency = m.count > 0 ? Math.round(m.latencySumMs / m.count) : 0;
    await redis
      .multi()
      .hincrby('metrics:poller:ticks', sym, m.count)
      .hset('metrics:poller:lastTickTs', sym, String(m.ts))
      .hset('metrics:poller:avgIngestLatencyMs', sym, String(avgLatency))
      .exec();
  }
}
