'use client';

import { DISPLAY_DECIMALS } from '@exness/shared';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { AccountFooter } from '@/components/AccountFooter';
import { AssetSidebar } from '@/components/AssetSidebar';
import { ChartPanel, type ChartOverlay } from '@/components/ChartPanel';
import { EditPositionModal } from '@/components/EditPositionModal';
import { OrderPanel } from '@/components/OrderPanel';
import { PositionsTabs } from '@/components/PositionsTabs';
import { ResizeHandle } from '@/components/ResizeHandle';
import { SettingsPopover } from '@/components/SettingsPopover';
import type { TF } from '@/components/TimeframePicker';
import type { AssetView } from '@/hooks/useAssets';
import { useOpenOrders, type OpenOrder } from '@/hooks/useOpenOrders';
import { fmtPrice } from '@/lib/format';
import { usePrice } from '@/store/prices';

const SIDEBAR_MIN = 300;
const SIDEBAR_MAX = 600;
const SIDEBAR_DEFAULT = 400;

export default function WebTradingPage() {
  const [asset, setAsset] = useState<AssetView['symbol']>('BTC');
  const [tf, setTf] = useState<TF>('1m');
  const [sidebarW, setSidebarW] = useState(SIDEBAR_DEFAULT);
  const [editingOrder, setEditingOrder] = useState<OpenOrder | null>(null);
  const { data: openOrders } = useOpenOrders();
  const live = usePrice(asset);

  useEffect(() => {
    if (!live) {
      document.title = `${asset} | Exness`;
      return;
    }
    const dec = live.decimals;
    const display = DISPLAY_DECIMALS[asset] ?? dec;
    document.title = `${asset} Bid ${fmtPrice(live.bid, dec, display)} | Exness`;
  }, [asset, live]);

  const overlays: ChartOverlay[] = useMemo(() => {
    const trades = openOrders?.trades.filter((t) => t.asset === asset) ?? [];
    const out: ChartOverlay[] = [];
    for (const t of trades) {
      const dec = t.decimals;
      out.push({
        price: t.liquidationPrice / 10 ** dec,
        color: '#ef4444',
        label: 'Liq',
      });
      if (t.stopLoss !== null) {
        out.push({ price: t.stopLoss / 10 ** dec, color: '#fb923c', label: 'SL' });
      }
      if (t.takeProfit !== null) {
        out.push({ price: t.takeProfit / 10 ** dec, color: '#22c55e', label: 'TP' });
      }
    }
    return out;
  }, [openOrders, asset]);

  return (
    <div className="grid h-screen grid-rows-[auto_1fr_auto]">
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-6 py-3">
        <span className="text-2xl font-bold tracking-tight text-[oklch(0.85_0.18_85)]">
          Exness
        </span>
        <div className="flex items-center gap-6">
          <Link
            href="/webtrading/health"
            className="text-xs text-[color:var(--color-fg-dim)] underline hover:opacity-80"
          >
            Health
          </Link>
          <SettingsPopover />
        </div>
      </header>
      <div
        className="grid overflow-hidden"
        style={{ gridTemplateColumns: `${sidebarW}px 4px 1fr 320px` }}
      >
        <AssetSidebar selected={asset} onSelect={setAsset} />
        <ResizeHandle
          onResize={(dx) =>
            setSidebarW((w) => Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w + dx)))
          }
        />
        <div className="flex flex-col">
          <div className="flex-1 overflow-hidden">
            <ChartPanel
              asset={asset}
              tf={tf}
              onTfChange={setTf}
              overlays={overlays}
              onEditPosition={setEditingOrder}
            />
          </div>
          <div className="h-[260px] border-t border-[color:var(--color-border)]">
            <PositionsTabs onEditPosition={setEditingOrder} />
          </div>
        </div>
        <aside className="border-l border-[color:var(--color-border)] p-4">
          <h2 className="mb-3 text-xs uppercase tracking-wider text-[color:var(--color-fg-dim)]">
            Order panel
          </h2>
          <OrderPanel selected={asset} />
        </aside>
      </div>
      <AccountFooter />

      {/* Single instance — both the table's Edit button and the chart's
          position marker open the same modal via setEditingOrder. */}
      <EditPositionModal
        open={editingOrder !== null}
        onOpenChange={(v) => {
          if (!v) setEditingOrder(null);
        }}
        order={editingOrder}
      />
    </div>
  );
}
