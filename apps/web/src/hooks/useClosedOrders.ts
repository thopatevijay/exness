'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSession } from '@/components/SessionProvider';

export type ClosedOrder = {
  orderId: string;
  asset: 'BTC' | 'ETH' | 'SOL';
  type: 'buy' | 'sell';
  margin: number;
  leverage: number;
  openPrice: number;
  closePrice: number;
  pnl: number;
  closeReason: 'manual' | 'sl' | 'tp' | 'liquidation';
  decimals: number;
  openedAt: string;
  closedAt: string;
};

export function useClosedOrders() {
  const session = useSession();
  return useInfiniteQuery({
    queryKey: ['closed-orders'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<{ trades: ClosedOrder[]; nextCursor: string | null }>(
        `/api/v1/trades?limit=50${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor,
    enabled: session.authed,
  });
}
