'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  value: number | null;
  decimals: number;
  displayDec?: number;
  className?: string;
  stale?: boolean;
};

export function PriceCell({ value, decimals, displayDec, className, stale = false }: Props) {
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value === null || prev.current === null || value === prev.current) {
      prev.current = value;
      return;
    }
    setFlash(value > prev.current ? 'up' : 'down');
    prev.current = value;
    const t = setTimeout(() => setFlash(null), 250);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span
      title={stale ? 'Price feed stale — last-known value shown' : undefined}
      className={cn(
        'font-mono tabular-nums',
        flash === 'up' && 'flash-up',
        flash === 'down' && 'flash-down',
        stale && 'opacity-50',
        className,
      )}
    >
      {value === null ? '—' : fmtPrice(value, decimals, displayDec)}
    </span>
  );
}
