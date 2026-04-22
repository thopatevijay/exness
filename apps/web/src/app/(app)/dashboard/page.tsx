'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AssetSidebar } from '@/components/AssetSidebar';
import { BalanceBar } from '@/components/BalanceBar';
import { ChartPanel } from '@/components/ChartPanel';
import type { TF } from '@/components/TimeframePicker';
import type { AssetView } from '@/hooks/useAssets';

export default function DashboardPage() {
  const router = useRouter();
  const [asset, setAsset] = useState<AssetView['symbol']>('BTC');
  const [tf, setTf] = useState<TF>('1m');

  async function logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="grid h-screen grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-6 py-3">
        <span className="text-base font-semibold">Exness</span>
        <button onClick={logout} className="text-sm text-[color:var(--color-fg-dim)] underline">
          Log out
        </button>
      </header>
      <div className="grid grid-cols-[280px_1fr_320px] overflow-hidden">
        <AssetSidebar selected={asset} onSelect={setAsset} />
        <div className="flex flex-col">
          <BalanceBar />
          <div className="flex-1 overflow-hidden">
            <ChartPanel asset={asset} tf={tf} onTfChange={setTf} />
          </div>
        </div>
        <aside className="border-l border-[color:var(--color-border)] p-4">
          <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-fg-dim)]">
            Order panel
          </h2>
          <p className="mt-2 text-sm text-[color:var(--color-fg-dim)]">Stage 13.</p>
        </aside>
      </div>
    </div>
  );
}
