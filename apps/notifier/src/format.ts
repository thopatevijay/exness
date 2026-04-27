import { ASSET_DECIMALS, type Symbol } from '@exness/shared';

export function fmtUsd(cents: bigint | number): string {
  // eslint-disable-next-line no-restricted-syntax -- presentation boundary: cents → display string
  const n = typeof cents === 'bigint' ? Number(cents) : cents;
  const dollars = n / 100;
  const sign = dollars < 0 ? '-' : '';
  return `${sign}$${Math.abs(dollars).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtSignedUsd(cents: bigint | number): string {
  // eslint-disable-next-line no-restricted-syntax -- presentation boundary: cents → display string
  const n = typeof cents === 'bigint' ? Number(cents) : cents;
  if (n === 0) return fmtUsd(0);
  return n > 0 ? `+${fmtUsd(n)}` : fmtUsd(n);
}

export function fmtAssetPrice(value: bigint | number, asset: Symbol): string {
  // eslint-disable-next-line no-restricted-syntax -- presentation boundary: scaled int → display string
  const n = typeof value === 'bigint' ? Number(value) : value;
  const dec = ASSET_DECIMALS[asset];
  const dollars = n / 10 ** dec;
  return `$${dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function shortOrderId(id: string): string {
  return id.slice(0, 8);
}

export function fmtSide(side: string): 'BUY' | 'SELL' {
  return side === 'buy' ? 'BUY' : 'SELL';
}

export function fmtLeverage(leverage: number): string {
  return leverage === 1 ? 'no leverage' : `${leverage}× leverage`;
}
