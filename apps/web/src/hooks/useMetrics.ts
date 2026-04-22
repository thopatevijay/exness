'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

export type MetricsSnapshot = {
  platformPnlUsdCents: number | null;
  openOrdersCount: number;
  wsActiveConnections: number | null;
  binanceFeedStaleMs: number | null;
  liquidationIndexSize: number | null;
  raw: Map<string, Sample[]>;
};

type Sample = { value: number; labels: Record<string, string> };

function parseProm(text: string): Map<string, Sample[]> {
  const out = new Map<string, Sample[]>();
  for (const line of text.split('\n')) {
    if (line.length === 0 || line.startsWith('#')) continue;
    const braceStart = line.indexOf('{');
    let name: string;
    let labelStr: string;
    let rest: string;
    if (braceStart === -1) {
      const sp = line.indexOf(' ');
      if (sp === -1) continue;
      name = line.slice(0, sp);
      labelStr = '';
      rest = line.slice(sp + 1);
    } else {
      name = line.slice(0, braceStart);
      const braceEnd = line.indexOf('}', braceStart);
      if (braceEnd === -1) continue;
      labelStr = line.slice(braceStart + 1, braceEnd);
      rest = line.slice(braceEnd + 1).trim();
    }
    // eslint-disable-next-line no-restricted-syntax -- Prom text boundary: string → number
    const value = Number(rest.split(' ')[0]);
    if (!Number.isFinite(value)) continue;
    const labels: Record<string, string> = {};
    if (labelStr.length > 0) {
      for (const part of labelStr.split(',')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        const k = part.slice(0, eq).trim();
        const v = part.slice(eq + 1).trim().replace(/^"|"$/g, '');
        labels[k] = v;
      }
    }
    const arr = out.get(name) ?? [];
    arr.push({ value, labels });
    out.set(name, arr);
  }
  return out;
}

function reduce(text: string): MetricsSnapshot {
  const raw = parseProm(text);
  const pnl = raw.get('platform_pnl_usd_cents')?.[0]?.value ?? null;
  const openCounts = raw.get('open_orders_count') ?? [];
  const openOrdersCount = openCounts.reduce((s, x) => s + x.value, 0);
  const ws = raw.get('ws_active_connections')?.[0]?.value ?? null;
  const stale = raw.get('binance_feed_stale_ms') ?? [];
  const finiteStale = stale.map((s) => s.value).filter((v) => Number.isFinite(v));
  const binanceFeedStaleMs = finiteStale.length > 0 ? Math.max(...finiteStale) : null;
  const liq = raw.get('liquidation_index_size')?.[0]?.value ?? null;
  return {
    platformPnlUsdCents: pnl,
    openOrdersCount,
    wsActiveConnections: ws,
    binanceFeedStaleMs,
    liquidationIndexSize: liq,
    raw,
  };
}

export function useMetrics(): UseQueryResult<MetricsSnapshot> {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const res = await fetch('/api/metrics', { cache: 'no-store' });
      const text = await res.text();
      return reduce(text);
    },
    refetchInterval: 10_000,
  });
}
