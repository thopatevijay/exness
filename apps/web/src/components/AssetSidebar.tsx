'use client';

import { DISPLAY_DECIMALS } from '@exness/shared';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useAssets, type AssetView } from '@/hooks/useAssets';
import { usePrice } from '@/store/prices';
import { fmtPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

const FLASH_MS = 1500;

// Single grid template shared by header + every row → guarantees column
// alignment. Fixed widths (not auto/minmax) so both grids resolve identically
// regardless of content — without this, the header's short "BID" text shrinks
// the column while the row's long "78,144.5488" expands it, and the dividers
// land in different x-positions.
const GRID_COLS = 'grid-cols-[1fr_56px_115px_115px]';

type Props = {
  selected: AssetView['symbol'];
  onSelect: (s: AssetView['symbol']) => void;
};

export function AssetSidebar({ selected, onSelect }: Props) {
  const { data, isLoading } = useAssets();
  const assets = data?.assets ?? [];

  return (
    <aside className="flex flex-col overflow-hidden border-r border-[color:var(--color-border)]">
      {/* Header — INSTRUMENTS label only (no non-functional icons) */}
      <div className="border-b border-[color:var(--color-border)] px-3 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-fg-dim)]">
          Instruments
        </span>
      </div>

      {/* Column headers */}
      <div
        className={cn(
          'grid items-center divide-x divide-[color:var(--color-border)] border-b border-[color:var(--color-border)] text-[11px] font-medium uppercase tracking-wider text-[color:var(--color-fg-dim)]',
          GRID_COLS,
        )}
      >
        <span className="px-3 py-2 text-center">Symbol</span>
        <span className="px-2 py-2 text-center">Signal</span>
        <span className="px-3 py-2 text-center">Bid</span>
        <span className="px-3 py-2 text-center">Ask</span>
      </div>

      {/* Rows */}
      <ul className="flex-1 overflow-auto">
        {isLoading && <li className="px-4 py-3 text-sm">Loading...</li>}
        {assets.map((a) => (
          <InstrumentRow
            key={a.symbol}
            asset={a}
            selected={selected === a.symbol}
            onSelect={() => onSelect(a.symbol)}
          />
        ))}
      </ul>
    </aside>
  );
}

function InstrumentRow({
  asset,
  selected,
  onSelect,
}: {
  asset: AssetView;
  selected: boolean;
  onSelect: () => void;
}) {
  const live = usePrice(asset.symbol);
  const bid = live?.bid ?? asset.bid;
  const ask = live?.ask ?? asset.ask;
  const decimals = live?.decimals ?? asset.decimals;
  const displayDec = DISPLAY_DECIMALS[asset.symbol] ?? decimals;

  // Signal — persistent direction of the last bid change. Defaults to null
  // until we observe a tick; sticks across re-renders so the user always
  // sees the most recent direction (matches Exness's persistent ▲/▼).
  const lastBid = useRef<number | null>(null);
  const [signal, setSignal] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (bid === null) return;
    const prev = lastBid.current;
    if (prev !== null) {
      if (bid > prev) setSignal('up');
      else if (bid < prev) setSignal('down');
    }
    lastBid.current = bid;
  }, [bid]);

  return (
    <li
      onClick={onSelect}
      className={cn(
        'grid cursor-pointer items-center divide-x divide-[color:var(--color-border)] border-b border-[color:var(--color-border)] text-sm hover:bg-[color:var(--color-bg-elevated)]',
        GRID_COLS,
        selected && 'bg-[color:var(--color-bg-elevated)]',
      )}
    >
      <span className="flex min-w-0 items-center gap-2 px-3 py-2.5">
        <Image src={asset.imageUrl} alt="" width={20} height={20} className="shrink-0" />
        <span className="truncate text-[14px] font-semibold">{asset.symbol}</span>
      </span>

      <span className="flex justify-center px-2 py-2.5">
        <SignalIndicator signal={signal} />
      </span>
      <span className="flex items-center justify-end px-3 py-2.5">
        <BidAskCell value={bid} decimals={decimals} displayDec={displayDec} />
      </span>
      <span className="flex items-center justify-end px-3 py-2.5">
        <BidAskCell value={ask} decimals={decimals} displayDec={displayDec} />
      </span>
    </li>
  );
}

function SignalIndicator({ signal }: { signal: 'up' | 'down' | null }) {
  if (signal === 'up') {
    return (
      <span
        aria-label="Signal up"
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-[color:var(--color-up)]/15 text-[11px] text-[color:var(--color-up)]"
      >
        ▲
      </span>
    );
  }
  if (signal === 'down') {
    return (
      <span
        aria-label="Signal down"
        className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-[color:var(--color-down)]/15 text-[11px] text-[color:var(--color-down)]"
      >
        ▼
      </span>
    );
  }
  return (
    <span
      aria-label="No signal yet"
      className="inline-flex h-5 w-5 items-center justify-center text-[11px] text-[color:var(--color-fg-dim)]"
    >
      ·
    </span>
  );
}

function BidAskCell({
  value,
  decimals,
  displayDec,
}: {
  value: number | null;
  decimals: number;
  displayDec: number;
}) {
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value === null) return;
    const before = prev.current;
    if (before === null) {
      prev.current = value;
      return;
    }
    if (value > before) setFlash('up');
    else if (value < before) setFlash('down');
    prev.current = value;
    const t = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-right font-mono text-[13px] tabular-nums transition-colors',
        flash === 'up' && 'bg-[color:var(--color-up)]/25 text-[color:var(--color-up)]',
        flash === 'down' && 'bg-[color:var(--color-down)]/25 text-[color:var(--color-down)]',
        flash === null && 'text-[color:var(--color-fg)]',
      )}
    >
      {value === null ? '—' : fmtPrice(value, decimals, displayDec)}
    </span>
  );
}
