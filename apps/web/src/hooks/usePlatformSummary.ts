'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type PlatformSummary = {
  platformPnlUsdCents: number;
  openOrders: number;
  closedTrades: number;
};

export function usePlatformSummary(): UseQueryResult<PlatformSummary> {
  return useQuery({
    queryKey: ['platform-summary'],
    queryFn: () => api<PlatformSummary>('/api/v1/admin/platform'),
    refetchInterval: 10_000,
  });
}
