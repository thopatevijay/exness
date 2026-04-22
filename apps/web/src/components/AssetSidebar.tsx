'use client';

import Image from 'next/image';
import { useAssets, type AssetView } from '@/hooks/useAssets';
import { usePrice } from '@/store/prices';
import { PriceCell } from './PriceCell';
import { cn } from '@/lib/utils';

const STALE_AFTER_MS = 5_000;

type Props = {
  selected: AssetView['symbol'];
  onSelect: (s: AssetView['symbol']) => void;
};

export function AssetSidebar({ selected, onSelect }: Props) {
  const { data, isLoading } = useAssets();
  const assets = data?.assets ?? [];

  return (
    <aside className="overflow-auto border-r border-[color:var(--color-border)]">
      <h2 className="px-4 py-3 text-xs uppercase tracking-wider text-[color:var(--color-fg-dim)]">
        Markets
      </h2>
      {isLoading && <p className="px-4 text-sm">Loading...</p>}
      <ul>
        {assets.map((a) => (
          <AssetRow
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

function AssetRow({
  asset,
  selected,
  onSelect,
}: {
  asset: AssetView;
  selected: boolean;
  onSelect: () => void;
}) {
  // Prefer live WS price; fall back to REST snapshot when the socket is warming up.
  const live = usePrice(asset.symbol);
  const buy = live?.buy ?? asset.buyPrice;
  const sell = live?.sell ?? asset.sellPrice;
  const decimals = live?.decimals ?? asset.decimals;
  const ts = live?.ts ?? asset.ts;
  const stale = ts !== null && ts !== undefined && Date.now() - ts > STALE_AFTER_MS;

  return (
    <li>
      <button
        onClick={onSelect}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[color:var(--color-bg-elevated)]',
          selected && 'bg-[color:var(--color-bg-elevated)]',
        )}
      >
        <span className="flex items-center gap-3">
          <Image src={asset.imageUrl} alt="" width={24} height={24} />
          <span>
            <div className="text-sm font-medium">{asset.symbol}</div>
            <div className="text-xs text-[color:var(--color-fg-dim)]">{asset.name}</div>
          </span>
        </span>
        <span className="text-right">
          <div className="text-xs text-[color:var(--color-fg-dim)]">Buy</div>
          <PriceCell value={buy} decimals={decimals} stale={stale} />
          <div className="text-xs text-[color:var(--color-fg-dim)]">Sell</div>
          <PriceCell value={sell} decimals={decimals} stale={stale} />
        </span>
      </button>
    </li>
  );
}
