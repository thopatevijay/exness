'use client';

import { DISPLAY_DECIMALS, type Symbol } from '@exness/shared';
import { Briefcase, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { AssetCell } from './AssetCell';
import { useOpenOrders, type OpenOrder } from '@/hooks/useOpenOrders';
import { useCloseTrade } from '@/hooks/useTradeMutations';
import { fmtPnl, fmtPrice, pnlClass } from '@/lib/format';
import { usePrice } from '@/store/prices';
import { cn } from '@/lib/utils';

type Props = {
  onEditPosition: (o: OpenOrder) => void;
};

export function OpenPositionsTable({ onEditPosition }: Props) {
  const { data, isLoading } = useOpenOrders();
  const closeMut = useCloseTrade();
  const trades = data?.trades ?? [];

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
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-[color:var(--color-fg-dim)]">
        <Briefcase className="h-8 w-8 opacity-60" />
        <p className="text-sm">No open positions.</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-[color:var(--color-fg-dim)]">
        <tr>
          <th className="px-2 py-2 text-left">Symbol</th>
          <th className="px-2 py-2 text-left">Side</th>
          <th className="px-2 py-2 text-right">Margin</th>
          <th className="px-2 py-2 text-right">Lev</th>
          <th className="px-2 py-2 text-right">Open</th>
          <th className="px-2 py-2 text-right">Current</th>
          <th className="px-2 py-2 text-right">Liq</th>
          <th className="px-2 py-2 text-right">PnL</th>
          <th className="px-2 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => (
          <tr key={t.orderId} className="border-t border-[color:var(--color-border)]">
            <td className="px-2 py-2">
              <AssetCell asset={t.asset} />
            </td>
            <td className="px-2 py-2">
              <SideCell side={t.type} />
            </td>
            <td className="px-2 py-2 text-right font-mono">${(t.margin / 100).toFixed(2)}</td>
            <td className="px-2 py-2 text-right font-mono">{t.leverage}x</td>
            <td className="px-2 py-2 text-right font-mono">
              {fmtPrice(t.openPrice, t.decimals, DISPLAY_DECIMALS[t.asset])}
            </td>
            <td className="px-2 py-2 text-right font-mono">
              <CurrentPriceCell asset={t.asset} side={t.type} decimals={t.decimals} />
            </td>
            <td className="px-2 py-2 text-right font-mono">
              {fmtPrice(t.liquidationPrice, t.decimals, DISPLAY_DECIMALS[t.asset])}
            </td>
            <td className={cn('px-2 py-2 text-right font-mono', pnlClass(t.unrealizedPnl))}>
              {fmtPnl(t.unrealizedPnl)}
            </td>
            <td className="px-2 py-2 text-right">
              <div className="inline-flex gap-1">
                <button
                  onClick={() => onEditPosition(t)}
                  aria-label="Edit position"
                  className="cursor-pointer rounded-md border border-[color:var(--color-border)] p-1.5 hover:bg-[color:var(--color-bg-elevated)]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleClose(t)}
                  disabled={closeMut.isPending}
                  className="cursor-pointer rounded-md border border-[color:var(--color-border)] px-2 py-1 text-xs hover:bg-[color:var(--color-bg-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Close
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CurrentPriceCell({
  asset,
  side,
  decimals,
}: {
  asset: Symbol;
  side: 'buy' | 'sell';
  decimals: number;
}) {
  const live = usePrice(asset);
  const value = side === 'buy' ? live?.bid : live?.ask;
  if (value === undefined || value === null) {
    return <span className="text-[color:var(--color-fg-dim)]">—</span>;
  }
  return <span>{fmtPrice(value, decimals, DISPLAY_DECIMALS[asset])}</span>;
}

// Colored bullet + side label, matching Exness's `● Buy / ● Sell`.
export function SideCell({ side }: { side: 'buy' | 'sell' }) {
  const isBuy = side === 'buy';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        isBuy ? 'text-[color:var(--color-accent)]' : 'text-[color:var(--color-down)]',
      )}
    >
      <span aria-hidden className="text-base leading-none">
        ●
      </span>
      {isBuy ? 'Buy' : 'Sell'}
    </span>
  );
}
