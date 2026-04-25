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

// Display precision — how many decimal digits the user *sees* in the UI.
// Independent of storage. Matches Exness/MT5 convention for crypto CFDs:
// high-magnitude assets show fewer digits (BTC at $77k → cent moves are noise),
// lower-magnitude assets need more precision to reveal natural tick size.
// All UI surfaces (sidebar, chart, tables, order panel) format to these.
export const DISPLAY_DECIMALS: Record<Symbol, number> = {
  BTC: 2,
  ETH: 2,
  SOL: 3,
};
