import { create } from 'zustand';
import type { Symbol } from '@exness/shared';

export type LivePrice = {
  // ask = price a long opens at (= "Buy" button).
  // bid = price a long closes at (= "Sell" button).
  ask: number;
  bid: number;
  decimals: number;
  ts: number;
};

type PricesState = {
  prices: Map<Symbol, LivePrice>;
  wsLatencyMs: number | null;
  wsLastConnectAt: number | null;
  setPrice: (sym: Symbol, p: LivePrice) => void;
  // Batched setter — collapses N symbol updates from one WS frame into a
  // single store write. Reduces Map allocations + downstream re-renders.
  setPrices: (updates: Array<[Symbol, LivePrice]>) => void;
  setWsLatency: (ms: number) => void;
  setWsConnected: (at: number) => void;
  reset: () => void;
};

export const usePricesStore = create<PricesState>((set) => ({
  prices: new Map(),
  wsLatencyMs: null,
  wsLastConnectAt: null,
  setPrice: (sym, p) =>
    set((s) => {
      const next = new Map(s.prices);
      next.set(sym, p);
      return { prices: next };
    }),
  setPrices: (updates) => {
    if (updates.length === 0) return;
    set((s) => {
      const next = new Map(s.prices);
      for (const [sym, p] of updates) next.set(sym, p);
      return { prices: next };
    });
  },
  setWsLatency: (ms) => set({ wsLatencyMs: ms }),
  setWsConnected: (at) => set({ wsLastConnectAt: at }),
  reset: () => set({ prices: new Map(), wsLatencyMs: null, wsLastConnectAt: null }),
}));

export function usePrice(sym: Symbol): LivePrice | undefined {
  return usePricesStore((s) => s.prices.get(sym));
}

export function useWsLatency(): number | null {
  return usePricesStore((s) => s.wsLatencyMs);
}
