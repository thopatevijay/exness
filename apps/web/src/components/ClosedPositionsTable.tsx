'use client';

import { DISPLAY_DECIMALS } from '@exness/shared';
import { format } from 'date-fns';
import type { ClosedOrder } from '@/hooks/useClosedOrders';
import { fmtPnl, fmtPrice, pnlClass } from '@/lib/format';
import { cn } from '@/lib/utils';

const REASON_BADGE = {
  manual: 'bg-[color:var(--color-bg-elevated)]',
  sl: 'bg-[color:var(--color-down)]/20',
  tp: 'bg-[color:var(--color-up)]/20',
  liquidation: 'bg-[color:var(--color-down)]/40',
} as const;

type Props = {
  trades: ClosedOrder[];
  isLoading?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  emptyLabel?: string;
};

export function ClosedPositionsTable({
  trades,
  isLoading = false,
  hasNextPage = false,
  onLoadMore,
  emptyLabel = 'No closed trades yet.',
}: Props) {
  if (isLoading && trades.length === 0) return <p className="p-2 text-sm">Loading...</p>;
  if (trades.length === 0) {
    return <p className="p-3 text-sm text-[color:var(--color-fg-dim)]">{emptyLabel}</p>;
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead className="text-xs text-[color:var(--color-fg-dim)]">
          <tr>
            <th className="px-2 py-2 text-left">Closed</th>
            <th className="px-2 py-2 text-left">Asset</th>
            <th className="px-2 py-2 text-left">Side</th>
            <th className="px-2 py-2 text-right">Margin</th>
            <th className="px-2 py-2 text-right">Lev</th>
            <th className="px-2 py-2 text-right">Open</th>
            <th className="px-2 py-2 text-right">Close</th>
            <th className="px-2 py-2 text-left">Reason</th>
            <th className="px-2 py-2 text-right">PnL</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.orderId} className="border-t border-[color:var(--color-border)]">
              <td className="px-2 py-2">{format(new Date(t.closedAt), 'MMM d HH:mm')}</td>
              <td className="px-2 py-2">{t.asset}</td>
              <td className="px-2 py-2">{t.type.toUpperCase()}</td>
              <td className="px-2 py-2 text-right font-mono">
                ${(t.margin / 100).toFixed(2)}
              </td>
              <td className="px-2 py-2 text-right font-mono">{t.leverage}x</td>
              <td className="px-2 py-2 text-right font-mono">
                {fmtPrice(t.openPrice, t.decimals, DISPLAY_DECIMALS[t.asset])}
              </td>
              <td className="px-2 py-2 text-right font-mono">
                {fmtPrice(t.closePrice, t.decimals, DISPLAY_DECIMALS[t.asset])}
              </td>
              <td className="px-2 py-2">
                <span className={cn('rounded-md px-2 py-0.5 text-xs', REASON_BADGE[t.closeReason])}>
                  {t.closeReason}
                </span>
              </td>
              <td className={cn('px-2 py-2 text-right font-mono', pnlClass(t.pnl))}>
                {fmtPnl(t.pnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasNextPage && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="mx-auto mt-3 block rounded-md border border-[color:var(--color-border)] px-3 py-1 text-sm hover:bg-[color:var(--color-bg-elevated)]"
        >
          Load more
        </button>
      )}
    </div>
  );
}
