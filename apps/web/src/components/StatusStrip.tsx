'use client';

import { usePlatformSummary } from '@/hooks/usePlatformSummary';
import { useMetrics } from '@/hooks/useMetrics';
import { useWsLatency } from '@/store/prices';
import { fmtPnl, pnlClass } from '@/lib/format';
import { cn } from '@/lib/utils';

type Tone = 'good' | 'warn' | 'dim';

export function StatusStrip() {
  const { data: platform } = usePlatformSummary();
  const { data: metrics } = useMetrics();
  const latency = useWsLatency();
  const feedAge = metrics?.binanceFeedStaleMs ?? null;
  const pnl = platform?.platformPnlUsdCents ?? null;

  return (
    <div className="flex items-center gap-6 text-xs">
      <Tile
        label="Platform PnL"
        title="House profit/loss across all users. Positive means the house is ahead."
        value={pnl !== null ? `$${fmtPnl(pnl)}` : '—'}
        {...(pnl !== null ? { className: pnlClass(pnl) } : {})}
      />
      <Tile
        label="Open (all)"
        title="Total open positions across every user (platform-wide, not just yours)."
        value={platform?.openOrders?.toString() ?? '—'}
      />
      <Tile
        label="WS"
        title="WebSocket round-trip latency (ping/pong, 5 s cadence)."
        value={latency !== null ? `${latency}ms` : '—'}
        tone={latency === null ? 'dim' : latency < 100 ? 'good' : 'warn'}
      />
      <Tile
        label="Feed"
        title="Max age of last Binance tick across assets. >5 s means the price feed is stalling."
        value={feedAge !== null ? `${(feedAge / 1000).toFixed(1)}s` : '—'}
        tone={feedAge === null ? 'dim' : feedAge < 5000 ? 'good' : 'warn'}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  tone = 'dim',
  className,
  title,
}: {
  label: string;
  value: string;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  const toneClass =
    tone === 'good'
      ? 'text-[color:var(--color-up)]'
      : tone === 'warn'
        ? 'text-[color:var(--color-down)]'
        : 'text-[color:var(--color-fg-dim)]';
  return (
    <div className="leading-tight" {...(title !== undefined ? { title } : {})}>
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-dim)]">
        {label}
      </div>
      <div className={cn('font-mono text-sm', className ?? toneClass)}>{value}</div>
    </div>
  );
}
