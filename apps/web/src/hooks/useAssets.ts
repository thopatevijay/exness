'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AssetView = {
  name: string;
  symbol: 'BTC' | 'ETH' | 'SOL';
  // Two-sided market quote. ask = price a long opens at (= "Buy" button).
  // bid = price a long closes at (= "Sell" button).
  ask: number | null;
  bid: number | null;
  ts: number | null; // ms timestamp of last tick; null when no price history exists
  decimals: number;
  imageUrl: string;
};

export function useAssets() {
  return useQuery({
    queryKey: ['assets'],
    queryFn: () => api<{ assets: AssetView[] }>('/api/v1/assets'),
    refetchInterval: 5_000,
  });
}
