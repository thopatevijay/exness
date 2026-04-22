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
  setPrice: (sym: Symbol, p: LivePrice) => void;
  reset: () => void;
};

export const usePricesStore = create<PricesState>((set) => ({
  prices: new Map(),
  setPrice: (sym, p) =>
    set((s) => {
      const next = new Map(s.prices);
      next.set(sym, p);
      return { prices: next };
    }),
  reset: () => set({ prices: new Map() }),
}));

export function usePrice(sym: Symbol): LivePrice | undefined {
  return usePricesStore((s) => s.prices.get(sym));
}
