'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ClosedPositionsTable } from './ClosedPositionsTable';
import { OpenPositionsTable } from './OpenPositionsTable';
import { useClosedOrders } from '@/hooks/useClosedOrders';
import { useOpenOrders, type OpenOrder } from '@/hooks/useOpenOrders';
import { cn } from '@/lib/utils';

const PREVIEW_LIMIT = 8;

type Props = {
  onEditPosition: (o: OpenOrder) => void;
};

export function PositionsTabs({ onEditPosition }: Props) {
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const { data: openData } = useOpenOrders();
  const { data, isLoading } = useClosedOrders();
  const allClosed = useMemo(() => data?.pages.flatMap((p) => p.trades) ?? [], [data]);
  const recent = allClosed.slice(0, PREVIEW_LIMIT);
  const openCount = openData?.trades.length ?? 0;

  const closedCount = allClosed.length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-[color:var(--color-border)]">
        <TabButton active={tab === 'open'} onClick={() => setTab('open')}>
          Open <CountBadge n={openCount} active={tab === 'open'} />
        </TabButton>
        <TabButton active={tab === 'closed'} onClick={() => setTab('closed')}>
          Closed <CountBadge n={closedCount} active={tab === 'closed'} />
        </TabButton>
        {tab === 'closed' && (
          <div className="ml-auto flex items-center pr-3">
            <Link
              href="/webtrading/history"
              className="text-xs text-[color:var(--color-fg-dim)] underline hover:opacity-80"
            >
              Full history →
            </Link>
          </div>
        )}
      </div>
      <div className="scrollbar-thin flex-1 overflow-auto">
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 px-3 py-2 text-sm',
        active && 'border-b-2 border-[color:var(--color-accent)]',
      )}
    >
      {children}
    </button>
  );
}

function CountBadge({ n, active }: { n: number; active: boolean }) {
  if (n === 0) return null;
  return (
    <span
      className={cn(
        'rounded-full px-1.5 text-[10px] tabular-nums',
        active
          ? 'bg-[color:var(--color-accent)]/20 text-[color:var(--color-accent)]'
          : 'bg-[color:var(--color-bg-elevated)] text-[color:var(--color-fg-dim)]',
      )}
    >
      {n}
    </span>
  );
}
