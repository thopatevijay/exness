import type { Amount, Price } from './types.js';

function assertSameDecimals(a: Price, b: Price): void {
  if (a.decimals !== b.decimals) {
    throw new Error(`decimals mismatch: ${a.decimals} vs ${b.decimals}`);
  }
}

export function add(a: Price, b: Price): Price {
  assertSameDecimals(a, b);
  return { value: a.value + b.value, decimals: a.decimals };
}

export function sub(a: Price, b: Price): Price {
  assertSameDecimals(a, b);
  return { value: a.value - b.value, decimals: a.decimals };
}

export function negate(a: Price): Price {
  return { value: -a.value, decimals: a.decimals };
}

export function cmp(a: Price, b: Price): -1 | 0 | 1 {
  assertSameDecimals(a, b);
  if (a.value < b.value) return -1;
  if (a.value > b.value) return 1;
  return 0;
}

export function max(a: Amount, b: Amount): Amount {
  assertSameDecimals(a, b);
  return a.value >= b.value ? a : b;
}

export function rescale(p: Price, target: number): Price {
  if (p.decimals === target) return p;
  if (p.decimals < target) {
    const factor = 10n ** BigInt(target - p.decimals);
    return { value: p.value * factor, decimals: target };
  }
  const factor = 10n ** BigInt(p.decimals - target);
  // round half-to-even
  const half = factor / 2n;
  const q = p.value / factor;
  const r = p.value % factor;
  let rounded = q;
  if (r > half) rounded = q + 1n;
  else if (r === half && q % 2n !== 0n) rounded = q + 1n;
  return { value: rounded, decimals: target };
}

export function mulDiv(a: Price, numer: bigint, denom: bigint): Price {
  if (denom === 0n) throw new Error('mulDiv: denom is zero');
  return { value: (a.value * numer) / denom, decimals: a.decimals };
}

export function mulInt(a: Amount, k: number | bigint): Amount {
  const factor = typeof k === 'bigint' ? k : BigInt(k);
  return { value: a.value * factor, decimals: a.decimals };
}
