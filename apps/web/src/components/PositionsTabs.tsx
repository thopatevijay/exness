'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ClosedPositionsTable } from './ClosedPositionsTable';
import { OpenPositionsTable } from './OpenPositionsTable';
import { useClosedOrders } from '@/hooks/useClosedOrders';
import type { OpenOrder } from '@/hooks/useOpenOrders';
import { cn } from '@/lib/utils';

const PREVIEW_LIMIT = 8;

type Props = {
  onEditPosition: (o: OpenOrder) => void;
};

export function PositionsTabs({ onEditPosition }: Props) {
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const { data, isLoading } = useClosedOrders();
  const recent = useMemo(() => {
    const all = data?.pages.flatMap((p) => p.trades) ?? [];
    return all.slice(0, PREVIEW_LIMIT);
  }, [data]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-[color:var(--color-border)]">
        <button
          onClick={() => setTab('open')}
          className={cn(
            'px-3 py-2 text-sm',
            tab === 'open' && 'border-b-2 border-[color:var(--color-accent)]',
          )}
        >
          Open
        </button>
        <button
          onClick={() => setTab('closed')}
          className={cn(
            'px-3 py-2 text-sm',
            tab === 'closed' && 'border-b-2 border-[color:var(--color-accent)]',
          )}
        >
          Closed
        </button>
        {tab === 'closed' && (
          <div className="ml-auto flex items-center pr-3">
            <Link
              href="/dashboard/history"
              className="text-xs text-[color:var(--color-fg-dim)] underline hover:opacity-80"
            >
              Full history →
            </Link>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'open' ? (
          <OpenPositionsTable onEditPosition={onEditPosition} />
        ) : (
          <ClosedPositionsTable
            trades={recent}
            isLoading={isLoading}
            emptyLabel="No closed trades yet."
          />
        )}
      </div>
    </div>
  );
}
