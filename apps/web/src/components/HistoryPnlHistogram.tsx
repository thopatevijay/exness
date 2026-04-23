'use client';

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ClosedOrder } from '@/hooks/useClosedOrders';

const BINS = 9;
const UP = 'rgb(34,197,94)';
const DOWN = 'rgb(239,68,68)';

type BinRow = {
  range: string;
  n: number;
  win: boolean;
};

export function HistoryPnlHistogram({ trades }: { trades: ClosedOrder[] }) {
  if (trades.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-[color:var(--color-fg-dim)]">
        No closed trades in this filter.
      </div>
    );
  }

  const pnlsUsd = trades.map((t) => t.pnl / 100);
  const min = Math.min(...pnlsUsd);
  const max = Math.max(...pnlsUsd);
  const step = (max - min) / BINS || 1;

  const data: BinRow[] = Array.from({ length: BINS }, (_, i) => {
    const lo = min + i * step;
    const hi = lo + step;
    const isLast = i === BINS - 1;
    const n = pnlsUsd.filter((p) => p >= lo && (isLast ? p <= hi : p < hi)).length;
    return {
      range: `${lo.toFixed(0)}…${hi.toFixed(0)}`,
      n,
      win: lo >= 0,
    };
  });

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <XAxis dataKey="range" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="#888" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{
              background: 'oklch(0.27 0.012 260)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: '#ccc' }}
          />
          <Bar dataKey="n" radius={[2, 2, 0, 0]}>
            {data.map((row, i) => (
              <Cell key={i} fill={row.win ? UP : DOWN} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
