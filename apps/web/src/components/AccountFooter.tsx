'use client';

import { useBalance } from '@/hooks/useBalance';
import { useOpenOrders } from '@/hooks/useOpenOrders';
import { fmtPnl, fmtUsd, pnlClass } from '@/lib/format';
import { cn } from '@/lib/utils';

// Math (all in cents — int internally; fmtUsd renders 2dp):
//   totalMargin   = Σ open margin
//   unrealizedPnl = Σ open unrealizedPnl
//   equity        = balance + unrealizedPnl
//   freeMargin    = equity − totalMargin
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
  const hasOpen = trades.length > 0;

  return (
    <footer className="flex items-center justify-between gap-6 border-t border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-6 py-2 text-xs">
      <div className="flex items-center gap-6">
        <Kpi label="Equity" value={`$${fmtUsd(equity)}`} />
        <Kpi label="Free Margin" value={`$${fmtUsd(freeMargin)}`} />
        <Kpi label="Balance" value={`$${fmtUsd(balance)}`} />
        <Kpi label="Margin" value={`$${fmtUsd(totalMargin)}`} />
      </div>
      {hasOpen && (
        <Kpi
          label="Total P/L"
          value={fmtPnl(unrealizedPnl)}
          valueClass={pnlClass(unrealizedPnl)}
        />
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

