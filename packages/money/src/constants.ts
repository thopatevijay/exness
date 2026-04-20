import type { Amount } from './types.js';

// Per spec: prices are stored at per-asset decimals (SOL=6, BTC=4, ETH=4).
// There is NO uniform "storage decimals" — each asset's prices live at the
// decimals defined for that asset in the assets table.
export const USD_DECIMALS = 2;
export const SPREAD_BPS = 100; // 1% total (50 each side)
export const BPS_DENOMINATOR = 10_000n;
export const VALID_LEVERAGES = [1, 5, 10, 20, 100] as const;
export type ValidLeverage = (typeof VALID_LEVERAGES)[number];

export const INITIAL_BALANCE: Amount = {
  value: 500_000n,
  decimals: USD_DECIMALS,
};
