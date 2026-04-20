import type { Price } from './types.js';

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

export function parseDecimalString(s: string, target: number): Price {
  if (!DECIMAL_RE.test(s)) throw new Error(`not a decimal string: ${s}`);
  const negative = s.startsWith('-');
  const body = negative ? s.slice(1) : s;
  const [intPartRaw, fracPartRaw = ''] = body.split('.');
  const intPart = intPartRaw ?? '0';
  const padded = (
    intPart +
    fracPartRaw +
    '0'.repeat(Math.max(0, target - fracPartRaw.length))
  ).slice(0, intPart.length + target);
  const big = BigInt(padded);
  return { value: negative ? -big : big, decimals: target };
}

// Parse a Binance WS trade price (e.g. "211.11000000") into an integer at the asset's decimals.
// Caller passes the asset decimals from ASSET_DECIMALS[sym].
export function parseBinancePrice(s: string, assetDecimals: number): Price {
  return parseDecimalString(s, assetDecimals);
}
