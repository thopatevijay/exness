import type { ValidLeverage } from './constants.js';
import { mulDiv, mulInt, sub } from './ops.js';
import type { Amount, Price, Side } from './types.js';

export function exposure(margin: Amount, leverage: ValidLeverage): Amount {
  return mulInt(margin, leverage);
}

export function liquidationPrice(side: Side, open: Price, leverage: ValidLeverage): Price {
  const L = BigInt(leverage);
  return side === 'buy' ? mulDiv(open, L - 1n, L) : mulDiv(open, L + 1n, L);
}

// pnl in USD, decimals=2.
// long:  exposure × (close − open) / open
// short: exposure × (open − close) / open
// We compute Δ as a price-ratio in storage decimals, then apply to exposure.
export function pnl(side: Side, exposureUsd: Amount, open: Price, close: Price): Amount {
  const delta = side === 'buy' ? sub(close, open) : sub(open, close);
  if (open.value === 0n) throw new Error('pnl: open price is zero');
  return {
    value: (exposureUsd.value * delta.value) / open.value,
    decimals: exposureUsd.decimals,
  };
}
