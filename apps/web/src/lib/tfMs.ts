export const TF_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '1d': 24 * 60 * 60_000,
  '1w': 7 * 24 * 60 * 60_000,
};

// Show ~150 candles by default
export function lookbackMs(ts: keyof typeof TF_MS): number {
  return TF_MS[ts]! * 150;
}
