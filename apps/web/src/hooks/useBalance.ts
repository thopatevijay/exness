'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useBalance() {
  return useQuery({
    queryKey: ['balance'],
    queryFn: () => api<{ usd_balance: number }>('/api/v1/user/balance'),
    refetchInterval: 5_000,
  });
}
