'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { EditPositionModal } from './EditPositionModal';
import { useOpenOrders, type OpenOrder } from '@/hooks/useOpenOrders';
import { useCloseTrade } from '@/hooks/useTradeMutations';
import { fmtPnl, fmtPrice, pnlClass } from '@/lib/format';
import { cn } from '@/lib/utils';

export function OpenPositionsTable() {
  const { data, isLoading } = useOpenOrders();
  const closeMut = useCloseTrade();
  const trades = data?.trades ?? [];
  const [editing, setEditing] = useState<OpenOrder | null>(null);

  const handleClose = async (o: OpenOrder): Promise<void> => {
    try {
      const r = await closeMut.mutateAsync(o.orderId);
      toast.success(`Closed ${o.asset} — pnl ${fmtPnl(r.pnl)}`);
    } catch {
      toast.error('Close failed (may already be closed)');
    }
  };

  if (isLoading) return <p className="p-2 text-sm">Loading...</p>;
  if (trades.length === 0) {
    return <p className="p-3 text-sm text-[color:var(--color-fg-dim)]">No open positions.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-[color:var(--color-fg-dim)]">
        <tr>
          <th className="px-2 py-2 text-left">Asset</th>
          <th className="px-2 py-2 text-left">Side</th>
          <th className="px-2 py-2 text-right">Margin</th>
          <th className="px-2 py-2 text-right">Lev</th>
          <th className="px-2 py-2 text-right">Open</th>
          <th className="px-2 py-2 text-right">Liq</th>
          <th className="px-2 py-2 text-right">PnL</th>
          <th className="px-2 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => (
          <tr key={t.orderId} className="border-t border-[color:var(--color-border)]">
            <td className="px-2 py-2">{t.asset}</td>
            <td
              className={cn(
                'px-2 py-2',
                t.type === 'buy'
                  ? 'text-[color:var(--color-up)]'
                  : 'text-[color:var(--color-down)]',
              )}
            >
              {t.type.toUpperCase()}
            </td>
            <td className="px-2 py-2 text-right font-mono">${(t.margin / 100).toFixed(2)}</td>
            <td className="px-2 py-2 text-right font-mono">{t.leverage}x</td>
            <td className="px-2 py-2 text-right font-mono">
              {fmtPrice(t.openPrice, t.decimals)}
            </td>
            <td className="px-2 py-2 text-right font-mono">
              {fmtPrice(t.liquidationPrice, t.decimals)}
            </td>
            <td className={cn('px-2 py-2 text-right font-mono', pnlClass(t.unrealizedPnl))}>
              {fmtPnl(t.unrealizedPnl)}
            </td>
            <td className="px-2 py-2 text-right">
              <div className="inline-flex gap-1">
                <button
                  onClick={() => setEditing(t)}
                  className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-xs hover:bg-[color:var(--color-bg-elevated)]"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleClose(t)}
                  disabled={closeMut.isPending}
                  className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-xs hover:bg-[color:var(--color-bg-elevated)]"
                >
                  Close
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={8}>
            <EditPositionModal
              open={editing !== null}
              onOpenChange={(v) => {
                if (!v) setEditing(null);
              }}
              order={editing}
            />
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
