'use client';

import Link from 'next/link';
import { useState } from 'react';
import { OpenPositionsTable } from './OpenPositionsTable';
import { cn } from '@/lib/utils';

export function PositionsTabs() {
  const [tab, setTab] = useState<'open' | 'closed'>('open');
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
        <div className="ml-auto flex items-center pr-3">
          <Link
            href="/dashboard/history"
            className="text-xs text-[color:var(--color-fg-dim)] underline"
          >
            Full history →
          </Link>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'open' ? (
          <OpenPositionsTable />
        ) : (
          <p className="p-3 text-sm text-[color:var(--color-fg-dim)]">
            See full history at{' '}
            <Link href="/dashboard/history" className="underline">
              /dashboard/history
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
