'use client';

import { useBalance } from '@/hooks/useBalance';
import { useOpenOrders } from '@/hooks/useOpenOrders';
import { fmtPnl, fmtUsd, pnlClass } from '@/lib/format';

export function BalanceBar() {
  const { data: bal } = useBalance();
  const { data: open } = useOpenOrders();
  const unrealized = (open?.trades ?? []).reduce((sum, t) => sum + t.unrealizedPnl, 0);
  const equity = (bal?.usd_balance ?? 0) + unrealized;

  return (
    <div className="flex items-center gap-6 border-b border-[color:var(--color-border)] px-6 py-3 text-sm">
      <div>
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-fg-dim)]">
          Balance
        </div>
        <div className="font-mono text-base">${bal ? fmtUsd(bal.usd_balance) : '—'}</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-fg-dim)]">
          Unrealized
        </div>
        <div className={`font-mono text-base ${pnlClass(unrealized)}`}>{fmtPnl(unrealized)}</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-fg-dim)]">
          Equity
        </div>
        <div className="font-mono text-base">${fmtUsd(equity)}</div>
      </div>
    </div>
  );
}
