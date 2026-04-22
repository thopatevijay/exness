import { create } from 'zustand';
import type { Symbol } from '@exness/shared';

export type LivePrice = {
  buy: number;
  sell: number;
  decimals: number;
  ts: number;
};

type PricesState = {
  prices: Map<Symbol, LivePrice>;
  wsLatencyMs: number | null;
  wsLastConnectAt: number | null;
  setPrice: (sym: Symbol, p: LivePrice) => void;
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
