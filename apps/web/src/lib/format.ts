export function fmtUsd(value: number, decimals = 2): string {
  return (value / 10 ** decimals).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtPrice(value: number, decimals: number): string {
  return (value / 10 ** decimals).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtPnl(value: number, decimals = 2): string {
  const v = value / 10 ** decimals;
  const s = v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v >= 0 ? `+${s}` : s;
}

export function pnlClass(value: number): string {
  if (value > 0) return 'text-[color:var(--color-up)]';
  if (value < 0) return 'text-[color:var(--color-down)]';
  return '';
}
