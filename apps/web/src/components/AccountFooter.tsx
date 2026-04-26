'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { toast } from 'sonner';
import { useBalance } from '@/hooks/useBalance';
import { useOpenOrders } from '@/hooks/useOpenOrders';
import { useCloseTrade } from '@/hooks/useTradeMutations';
import { fmtPnl, fmtUsd, pnlClass } from '@/lib/format';
import { cn } from '@/lib/utils';

// Bottom strip showing account state. Five left KPIs (Exness convention);
// right side flips on when the user has open positions and surfaces the
// running unrealized PnL + a Close-all button.
//
// Math (all in cents — int internally; fmtUsd renders 2dp):
//   totalMargin   = Σ open margin
//   unrealizedPnl = Σ open unrealizedPnl
//   equity        = balance + unrealizedPnl
//   freeMargin    = equity − totalMargin
//   marginLevel   = totalMargin > 0 ? equity / totalMargin × 100 : null
export function AccountFooter() {
  const { data: bal } = useBalance();
  const { data: open } = useOpenOrders();
  const trades = open?.trades ?? [];
  const balance = bal?.usd_balance ?? 0;
  const totalMargin = trades.reduce((s, t) => s + t.margin, 0);
  const unrealizedPnl = trades.reduce((s, t) => s + t.unrealizedPnl, 0);
  const equity = balance + unrealizedPnl;
  // Free margin can go negative when a deep loser eats into the cash
  // collateral. Display it honestly — clamping would hide a real margin
  // call signal from the user.
  const freeMargin = equity - totalMargin;
  const marginLevelPct = totalMargin > 0 ? (equity / totalMargin) * 100 : null;
  const hasOpen = trades.length > 0;

  return (
    <footer className="flex items-center justify-between gap-6 border-t border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-6 py-2 text-xs">
      <div className="flex items-center gap-6">
        <Kpi label="Equity" value={`$${fmtUsd(equity)}`} />
        <Kpi label="Free Margin" value={`$${fmtUsd(freeMargin)}`} />
        <Kpi label="Balance" value={`$${fmtUsd(balance)}`} />
        <Kpi label="Margin" value={`$${fmtUsd(totalMargin)}`} />
        <Kpi
          label="Margin level"
          value={marginLevelPct === null ? '—' : `${marginLevelPct.toFixed(2)}%`}
        />
      </div>
      {hasOpen && (
        <div className="flex items-center gap-4">
          <Kpi
            label="Total P/L"
            value={fmtPnl(unrealizedPnl)}
            valueClass={pnlClass(unrealizedPnl)}
          />
          <CloseAllButton orderIds={trades.map((t) => t.orderId)} />
        </div>
      )}
    </footer>
  );
}

function Kpi({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="leading-tight">
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-dim)]">
        {label}
      </div>
      <div className={cn('font-mono text-sm', valueClass)}>{value}</div>
    </div>
  );
}

function CloseAllButton({ orderIds }: { orderIds: string[] }) {
  const closeMut = useCloseTrade();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const closeAll = async (): Promise<void> => {
    setBusy(true);
    // Sequential, not Promise.all — server enforces per-user serialization
    // anyway, and racing the close calls means duplicate idem-key generation
    // and confusing error attribution if a few fail.
    let ok = 0;
    let fail = 0;
    for (const id of orderIds) {
      try {
        await closeMut.mutateAsync(id);
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    setBusy(false);
    setOpen(false);
    if (fail === 0) toast.success(`Closed ${ok} positions`);
    else if (ok === 0) toast.error(`Close failed for all ${fail} positions`);
    else toast.warning(`Closed ${ok}, failed ${fail}`);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="cursor-pointer rounded-md bg-[color:var(--color-down)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
        >
          Close all ({orderIds.length})
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-[oklch(0.27_0.012_260)] p-4 text-sm shadow-[0_16px_40px_rgba(0,0,0,0.65)] ring-1 ring-white/5"
        >
          <Dialog.Title className="text-sm font-semibold">
            Close all {orderIds.length} positions?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs text-[color:var(--color-fg-dim)]">
            Each position will close at its current market quote. This action can&apos;t be undone.
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={busy}
                className="cursor-pointer rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-xs hover:bg-[color:var(--color-bg-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={busy}
              onClick={closeAll}
              className="cursor-pointer rounded-md bg-[color:var(--color-down)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Closing…' : 'Close all'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
