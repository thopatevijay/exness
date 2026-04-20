export const SYMBOLS = ['BTC', 'ETH', 'SOL'] as const;
export type Symbol = (typeof SYMBOLS)[number];

// Per-asset decimals — the single source of truth for scale.
// Prices for each asset are stored, transported, and serialized at exactly these decimals.
// Per spec: "store SOL as 211110000 with decimals 6".
export const ASSET_DECIMALS: Record<Symbol, number> = {
  BTC: 4,
  ETH: 4,
  SOL: 6,
};
