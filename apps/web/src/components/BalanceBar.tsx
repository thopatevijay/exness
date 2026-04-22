'use client';

import { useBalance } from '@/hooks/useBalance';
import { fmtUsd } from '@/lib/format';

export function BalanceBar() {
  const { data } = useBalance();
  return (
    <div className="flex items-center gap-6 border-b border-[color:var(--color-border)] px-6 py-3 text-sm">
      <div>
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-fg-dim)]">
          Balance
        </div>
        <div className="font-mono text-base">${data ? fmtUsd(data.usd_balance) : '—'}</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-fg-dim)]">
          Equity
        </div>
        <div className="font-mono text-base">
          ${data ? fmtUsd(data.usd_balance) : '—'}{' '}
          <span className="text-xs text-[color:var(--color-fg-dim)]">
            (Stage 13 adds unrealized PnL)
          </span>
        </div>
      </div>
    </div>
  );
}
