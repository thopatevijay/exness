'use client';

import { DISPLAY_DECIMALS } from '@exness/shared';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useAssets, type AssetView } from '@/hooks/useAssets';
import { PriceCell } from './PriceCell';
import { usePrice } from '@/store/prices';
import { cn } from '@/lib/utils';

export function TickerStrip() {
  const { data } = useAssets();
  const assets = data?.assets ?? [];
  return (
    <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {assets.map((a) => (
        <TickerCard key={a.symbol} asset={a} />
      ))}
    </div>
  );
}

function TickerCard({ asset }: { asset: AssetView }) {
  const live = usePrice(asset.symbol);
  const ask = live?.ask ?? asset.ask;
  const bid = live?.bid ?? asset.bid;
  const decimals = live?.decimals ?? asset.decimals;
  const displayDec = DISPLAY_DECIMALS[asset.symbol] ?? decimals;

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
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src={asset.imageUrl} alt="" width={32} height={32} />
          <div className="leading-tight">
            <div className="text-base font-semibold">{asset.symbol}</div>
            <div className="text-[11px] uppercase tracking-wider text-[color:var(--color-fg-dim)]">
              {asset.name}
            </div>
          </div>
        </div>
        <SignalBadge signal={signal} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Quote label="Bid" tone="down" value={bid} decimals={decimals} displayDec={displayDec} />
        <Quote label="Ask" tone="up" value={ask} decimals={decimals} displayDec={displayDec} />
      </div>
    </div>
  );
}

function Quote({
  label,
  tone,
  value,
  decimals,
  displayDec,
}: {
  label: string;
  tone: 'up' | 'down';
  value: number | null;
  decimals: number;
  displayDec: number;
}) {
  return (
    <div className="rounded-md bg-[color:var(--color-bg)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-dim)]">
        {label}
      </div>
      <PriceCell
        value={value}
        decimals={decimals}
        displayDec={displayDec}
        className={cn(
          'mt-0.5 block text-lg',
          tone === 'up' ? 'text-[color:var(--color-up)]' : 'text-[color:var(--color-down)]',
        )}
      />
    </div>
  );
}

function SignalBadge({ signal }: { signal: 'up' | 'down' | null }) {
  if (signal === null) {
    return (
      <span className="rounded-sm bg-[color:var(--color-bg)] px-1.5 py-0.5 text-[10px] text-[color:var(--color-fg-dim)]">
        ·
      </span>
    );
  }
  const isUp = signal === 'up';
  return (
    <span
      aria-label={isUp ? 'Last tick up' : 'Last tick down'}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-sm text-xs',
        isUp
          ? 'bg-[color:var(--color-up)]/15 text-[color:var(--color-up)]'
          : 'bg-[color:var(--color-down)]/15 text-[color:var(--color-down)]',
      )}
    >
      {isUp ? '▲' : '▼'}
    </span>
  );
}
