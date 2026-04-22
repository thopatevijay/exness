'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AssetView = {
  name: string;
  symbol: 'BTC' | 'ETH' | 'SOL';
  buyPrice: number | null;
  sellPrice: number | null;
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
