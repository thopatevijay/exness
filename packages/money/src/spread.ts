import { BPS_DENOMINATOR, SPREAD_BPS } from './constants.js';
import { mulDiv } from './ops.js';
import type { Price } from './types.js';

// `ask` is mid + half-spread (what a long pays to open / what a short closes at).
// `bid` is mid − half-spread (what a long closes at / what a short opens at).
export function applySpread(mid: Price): { ask: Price; bid: Price } {
  const half = BigInt(SPREAD_BPS) / 2n;
  return {
    ask: mulDiv(mid, BPS_DENOMINATOR + half, BPS_DENOMINATOR),
    bid: mulDiv(mid, BPS_DENOMINATOR - half, BPS_DENOMINATOR),
  };
}
