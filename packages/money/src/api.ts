import { USD_DECIMALS } from './constants.js';
import type { Amount, Price } from './types.js';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

// Prices are ALREADY stored at the asset's decimals (per spec). toApi() is an
// identity pass-through that just converts bigint → number for JSON wire output.
// If the caller's Price has different decimals than the asset, that's a bug —
// we assert here.
export function toApi(
  p: Price,
  expectedDecimals: number,
): { value: number; decimals: number } {
  if (p.decimals !== expectedDecimals) {
    throw new Error(
      `toApi: decimals mismatch — got ${p.decimals}, expected ${expectedDecimals}. ` +
        `Prices must already be stored at the asset's decimals.`,
    );
  }
  if (p.value > MAX_SAFE || p.value < -MAX_SAFE) {
    throw new Error(`toApi value exceeds Number.MAX_SAFE_INTEGER: ${p.value}`);
  }
  return { value: Number(p.value), decimals: p.decimals };
}

export function amountFromApiUsd(n: number): Amount {
  if (!Number.isInteger(n)) throw new Error(`amountFromApiUsd expects integer cents: ${n}`);
  return { value: BigInt(n), decimals: USD_DECIMALS };
}
