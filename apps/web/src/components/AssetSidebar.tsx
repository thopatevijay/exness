'use client';

import Image from 'next/image';
import { useAssets, type AssetView } from '@/hooks/useAssets';
import { PriceCell } from './PriceCell';
import { cn } from '@/lib/utils';

type Props = {
  selected: AssetView['symbol'];
  onSelect: (s: AssetView['symbol']) => void;
};

export function AssetSidebar({ selected, onSelect }: Props) {
  const { data, isLoading } = useAssets();
  const assets = data?.assets ?? [];

  return (
    <aside className="border-r border-[color:var(--color-border)]">
      <h2 className="px-4 py-3 text-xs uppercase tracking-wider text-[color:var(--color-fg-dim)]">
        Markets
      </h2>
      {isLoading && <p className="px-4 text-sm">Loading...</p>}
      <ul>
        {assets.map((a) => (
          <li key={a.symbol}>
            <button
              onClick={() => onSelect(a.symbol)}
              className={cn(
                'flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[color:var(--color-bg-elevated)]',
                selected === a.symbol && 'bg-[color:var(--color-bg-elevated)]',
              )}
            >
              <span className="flex items-center gap-3">
                <Image src={a.imageUrl} alt="" width={24} height={24} />
                <span>
                  <div className="text-sm font-medium">{a.symbol}</div>
                  <div className="text-xs text-[color:var(--color-fg-dim)]">{a.name}</div>
                </span>
              </span>
              <span className="text-right">
                <div className="text-xs text-[color:var(--color-fg-dim)]">Buy</div>
                <PriceCell value={a.buyPrice} decimals={a.decimals} />
                <div className="text-xs text-[color:var(--color-fg-dim)]">Sell</div>
                <PriceCell value={a.sellPrice} decimals={a.decimals} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
