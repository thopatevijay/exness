'use client';

import { cn } from '@/lib/utils';

const TFS = ['1m', '5m', '15m', '1h', '1d', '1w'] as const;
export type TF = (typeof TFS)[number];

type Props = {
  value: TF;
  onChange: (tf: TF) => void;
};

export function TimeframePicker({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-md border border-[color:var(--color-border)]">
      {TFS.map((tf) => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          className={cn(
            'px-3 py-1 text-sm font-mono first:rounded-l-md last:rounded-r-md',
            value === tf
              ? 'bg-[color:var(--color-accent)] text-black'
              : 'hover:bg-[color:var(--color-bg-elevated)]',
          )}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
