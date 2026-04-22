'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type OpenOrder = {
  orderId: string;
  asset: 'BTC' | 'ETH' | 'SOL';
  type: 'buy' | 'sell';
  margin: number;
  leverage: number;
  openPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  liquidationPrice: number;
  unrealizedPnl: number;
  decimals: number;
  openedAt: string;
};

export function useOpenOrders() {
  return useQuery({
    queryKey: ['open-orders'],
    queryFn: () => api<{ trades: OpenOrder[] }>('/api/v1/trades/open'),
    refetchInterval: 5_000,
  });
}
