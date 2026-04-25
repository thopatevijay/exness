'use client';

import { DISPLAY_DECIMALS } from '@exness/shared';
import Image from 'next/image';
import { useAssets, type AssetView } from '@/hooks/useAssets';
import { PriceCell } from './PriceCell';
import { usePrice } from '@/store/prices';

export function TickerStrip() {
  const { data } = useAssets();
  const assets = data?.assets ?? [];
  return (
    <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {assets.map((a) => (
        <TickerRow key={a.symbol} asset={a} />
      ))}
    </div>
  );
}

function TickerRow({ asset }: { asset: AssetView }) {
  const live = usePrice(asset.symbol);
  const ask = live?.ask ?? asset.ask;
  const bid = live?.bid ?? asset.bid;
  const decimals = live?.decimals ?? asset.decimals;
  const displayDec = DISPLAY_DECIMALS[asset.symbol] ?? decimals;
  return (
    <div className="flex items-center justify-between rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-4 py-3">
      <span className="flex items-center gap-3">
        <Image src={asset.imageUrl} alt="" width={28} height={28} />
        <span className="text-sm font-medium">{asset.symbol}</span>
      </span>
      <span className="flex flex-col text-right">
        <PriceCell
          value={ask}
          decimals={decimals}
          displayDec={displayDec}
          className="text-[color:var(--color-up)]"
        />
        <PriceCell
          value={bid}
          decimals={decimals}
          displayDec={displayDec}
          className="text-[color:var(--color-down)]"
        />
      </span>
    </div>
  );
}
