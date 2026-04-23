'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ClosedPositionsTable } from '@/components/ClosedPositionsTable';
import { HistoryFilters, type AssetFilter } from '@/components/HistoryFilters';
import { HistoryPnlHistogram } from '@/components/HistoryPnlHistogram';
import { useClosedOrders, type ClosedOrder } from '@/hooks/useClosedOrders';
import { downloadCsv, toCsv } from '@/lib/csv';

const CSV_HEADERS: (keyof ClosedOrder)[] = [
  'orderId',
  'asset',
  'type',
  'margin',
  'leverage',
  'openPrice',
  'closePrice',
  'pnl',
  'closeReason',
  'openedAt',
  'closedAt',
];

export default function HistoryPage() {
  const [asset, setAsset] = useState<AssetFilter>('ALL');
  const { data, fetchNextPage, hasNextPage, isLoading } = useClosedOrders();
  const all = useMemo(() => data?.pages.flatMap((p) => p.trades) ?? [], [data]);
  const filtered = useMemo(
    () => (asset === 'ALL' ? all : all.filter((t) => t.asset === asset)),
    [all, asset],
  );

  function exportCsv(): void {
    if (filtered.length === 0) return;
    const csv = toCsv(
      filtered as unknown as Record<string, unknown>[],
      CSV_HEADERS as string[],
    );
    const ymd = new Date().toISOString().slice(0, 10);
    downloadCsv(`trades-${ymd}.csv`, csv);
  }

  return (
    <main className="p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-xs text-[color:var(--color-fg-dim)] underline hover:opacity-80"
          >
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold">History</h1>
        </div>
        <div className="flex items-center gap-4">
          <HistoryFilters value={asset} onChange={setAsset} />
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="rounded-md border border-[color:var(--color-border)] px-3 py-1 text-sm hover:bg-[color:var(--color-bg-elevated)] disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </header>

      <section className="mt-4">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-[color:var(--color-fg-dim)]">
          Realized pnl distribution ({filtered.length} {filtered.length === 1 ? 'trade' : 'trades'})
        </div>
        <HistoryPnlHistogram trades={filtered} />
      </section>

      <section className="mt-4 overflow-x-auto rounded-md border border-[color:var(--color-border)]">
        <ClosedPositionsTable
          trades={filtered}
          isLoading={isLoading}
          hasNextPage={hasNextPage ?? false}
          onLoadMore={() => void fetchNextPage()}
          emptyLabel={
            asset === 'ALL'
              ? 'No closed trades yet.'
              : `No closed ${asset} trades. Try "All" or another asset.`
          }
        />
      </section>
    </main>
  );
}
