export function fmtUsd(value: number, decimals = 2): string {
  return (value / 10 ** decimals).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// `decimals` is the *storage* scale (the divisor that turns the integer back
// into a real-world price). `displayDecimals` controls the *rendered*
// fractional-digit count and defaults to `decimals` when omitted. Splitting
// the two lets us keep storage at full precision while displaying at the
// asset's natural pip size (BTC=2, SOL=3, etc).
export function fmtPrice(value: number, decimals: number, displayDecimals?: number): string {
  const display = displayDecimals ?? decimals;
  return (value / 10 ** decimals).toLocaleString(undefined, {
    minimumFractionDigits: display,
    maximumFractionDigits: display,
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
