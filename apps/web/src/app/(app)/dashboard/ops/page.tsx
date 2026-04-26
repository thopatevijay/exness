'use client';

import Link from 'next/link';
import { HealthBadge } from '@/components/HealthBadge';
import { useMetrics } from '@/hooks/useMetrics';
import { usePlatformSummary } from '@/hooks/usePlatformSummary';
import { HEALTH_SERVICES } from '@/hooks/useHealth';
import { fmtPnl, pnlClass } from '@/lib/format';

export default function OpsPage() {
  const { data: metrics } = useMetrics();
  const { data: platform } = usePlatformSummary();

  return (
    <main className="min-h-screen p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Health</h1>
        <Link
          href="/dashboard"
          className="text-xs text-[color:var(--color-fg-dim)] underline hover:opacity-80"
        >
          ← Dashboard
        </Link>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-xs uppercase tracking-wider text-[color:var(--color-fg-dim)]">
          Services
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {HEALTH_SERVICES.map((svc) => (
            <HealthBadge key={svc} svc={svc} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-xs uppercase tracking-wider text-[color:var(--color-fg-dim)]">
          Platform totals
        </h2>
        <p className="mb-2 text-xs text-[color:var(--color-fg-dim)]">
          Aggregated across all users — not filtered to your account.
        </p>
        <div className="overflow-hidden rounded-md border border-[color:var(--color-border)]">
          <table className="w-full text-sm">
            <tbody>
              <Row
                label="Platform PnL"
                value={
                  platform
                    ? `$${fmtPnl(platform.platformPnlUsdCents)}`
                    : metrics?.platformPnlUsdCents !== null &&
                        metrics?.platformPnlUsdCents !== undefined
                      ? `$${fmtPnl(metrics.platformPnlUsdCents)}`
                      : '—'
                }
                className={
                  platform ? pnlClass(platform.platformPnlUsdCents) : ''
                }
              />
              <Row label="Open orders" value={fmt(platform?.openOrders ?? metrics?.openOrdersCount)} />
              <Row label="Closed trades" value={fmt(platform?.closedTrades)} />
              <Row
                label="WS connections"
                value={fmt(metrics?.wsActiveConnections)}
              />
              <Row
                label="Binance feed age (max)"
                value={
                  metrics?.binanceFeedStaleMs !== null &&
                  metrics?.binanceFeedStaleMs !== undefined
                    ? `${(metrics.binanceFeedStaleMs / 1000).toFixed(1)}s`
                    : '—'
                }
              />
              <Row
                label="Liquidation index size"
                value={fmt(metrics?.liquidationIndexSize)}
              />
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function fmt(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return v.toString();
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <tr className="border-b border-[color:var(--color-border)] last:border-b-0">
      <td className="px-3 py-2 text-[color:var(--color-fg-dim)]">{label}</td>
      <td className={`px-3 py-2 text-right font-mono ${className ?? ''}`}>{value}</td>
    </tr>
  );
}
