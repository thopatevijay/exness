'use client';

import Image from 'next/image';
import type { Symbol } from '@exness/shared';
import { useAssets } from '@/hooks/useAssets';

export function AssetCell({ asset }: { asset: Symbol }) {
  const { data } = useAssets();
  const meta = data?.assets.find((a) => a.symbol === asset);
  return (
    <span className="inline-flex items-center gap-2">
      {meta?.imageUrl && (
        <Image src={meta.imageUrl} alt="" width={16} height={16} className="shrink-0" />
      )}
      <span>{asset}</span>
    </span>
  );
}
