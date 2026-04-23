'use client';

import { SYMBOLS, type Symbol } from '@exness/shared';

export type AssetFilter = Symbol | 'ALL';

type Props = {
  value: AssetFilter;
  onChange: (v: AssetFilter) => void;
};

export function HistoryFilters({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-fg-dim)]">
        Asset
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AssetFilter)}
        className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-2 py-1 text-sm"
      >
        <option value="ALL">All</option>
        {SYMBOLS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
