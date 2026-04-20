import { BPS_DENOMINATOR, SPREAD_BPS } from './constants.js';
import { mulDiv } from './ops.js';
import type { Price } from './types.js';

export function applySpread(mid: Price): { buy: Price; sell: Price } {
  const half = BigInt(SPREAD_BPS) / 2n;
  return {
    buy: mulDiv(mid, BPS_DENOMINATOR + half, BPS_DENOMINATOR),
    sell: mulDiv(mid, BPS_DENOMINATOR - half, BPS_DENOMINATOR),
  };
}
