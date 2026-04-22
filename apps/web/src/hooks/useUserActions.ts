'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type Me = {
  email: string;
  createdAt: string;
  openCount: number;
  closedCount: number;
  realizedCents: number;
};

export function useMe(): UseQueryResult<Me> {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/api/v1/user/me'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>): void {
  for (const k of [
    ['balance'],
    ['open-orders'],
    ['closed-orders'],
    ['platform-summary'],
    ['me'],
  ]) {
    qc.invalidateQueries({ queryKey: k });
  }
}

export function useDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ usd_balance: number; added: number }>('/api/v1/user/deposit', { method: 'POST' }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ ok: true; usd_balance: number; removedOrders: number }>('/api/v1/user/reset-demo', {
        method: 'POST',
      }),
    onSuccess: () => invalidateAll(qc),
  });
}
