'use client';

import * as Popover from '@radix-ui/react-popover';
import { Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useBalance } from '@/hooks/useBalance';
import { useOpenOrders } from '@/hooks/useOpenOrders';
import { useDeposit, useMe, useResetDemo } from '@/hooks/useUserActions';
import { fmtPnl, fmtUsd, pnlClass } from '@/lib/format';
import { cn } from '@/lib/utils';

export function SettingsPopover() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const me = useMe();
  const bal = useBalance();
  const open = useOpenOrders();
  const deposit = useDeposit();
  const reset = useResetDemo();

  const unrealized = (open.data?.trades ?? []).reduce((s, t) => s + t.unrealizedPnl, 0);
  const balanceCents = bal.data?.usd_balance ?? 0;
  const equity = balanceCents + unrealized;
  const realized = me.data?.realizedCents ?? 0;
  const openCount = me.data?.openCount ?? open.data?.trades?.length ?? 0;
  const lifetimeCount = me.data?.closedCount ?? 0;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function onDeposit() {
    try {
      await deposit.mutateAsync();
      toast.success('Deposited $5,000.00');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deposit failed');
    }
  }

  async function onReset() {
    if (!confirm('Wipe all your open and closed trades, and restore balance to $5,000? This cannot be undone.')) return;
    try {
      const r = await reset.mutateAsync();
      toast.success(`Demo account reset — removed ${r.removedOrders} open position(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed');
    }
  }

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          aria-label="Settings"
          className="rounded-md border border-[color:var(--color-border)] p-1.5 hover:bg-[color:var(--color-bg-elevated)]"
        >
          <Settings size={16} />
        </button>
      </Popover.Trigger>
      {isOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/30"
        />
      )}
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-50 w-72 rounded-md border border-white/50 bg-[oklch(0.27_0.012_260)] p-4 text-sm shadow-[0_16px_40px_rgba(0,0,0,0.65)] ring-1 ring-white/5"
        >
          <div className="mb-3">
            <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-dim)]">
              Signed in
            </div>
            <div className="truncate font-mono text-sm">{me.data?.email ?? '—'}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Tile label="Balance" value={`$${fmtUsd(balanceCents)}`} />
            <Tile label="Equity" value={`$${fmtUsd(equity)}`} />
            <Tile
              label="Unrealized"
              value={fmtPnl(unrealized)}
              className={pnlClass(unrealized)}
            />
            <Tile label="Realized" value={fmtPnl(realized)} className={pnlClass(realized)} />
            <Tile label="Open" value={openCount.toString()} />
            <Tile label="Lifetime" value={lifetimeCount.toString()} />
          </div>

          <div className="mt-4 space-y-2">
            <button
              onClick={onDeposit}
              disabled={deposit.isPending}
              className="w-full rounded-md bg-[color:var(--color-accent)] py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
            >
              {deposit.isPending ? 'Depositing…' : 'Deposit +$5,000'}
            </button>
            <button
              onClick={onReset}
              disabled={reset.isPending}
              className="w-full rounded-md border border-[color:var(--color-down)] py-2 text-xs text-[color:var(--color-down)] hover:bg-[color:var(--color-down)] hover:text-black disabled:opacity-50"
            >
              {reset.isPending ? 'Resetting…' : 'Reset demo account'}
            </button>
            <button
              onClick={logout}
              className="w-full rounded-md border border-[color:var(--color-border)] py-2 text-sm text-[color:var(--color-fg-dim)] hover:bg-[color:var(--color-bg-elevated)]"
            >
              Log out
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Tile({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-md bg-[color:var(--color-bg)] p-2">
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-dim)]">
        {label}
      </div>
      <div className={cn('font-mono text-sm', className)}>{value}</div>
    </div>
  );
}
