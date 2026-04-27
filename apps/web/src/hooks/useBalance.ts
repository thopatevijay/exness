'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSession } from '@/components/SessionProvider';

export function useBalance() {
  const session = useSession();
  return useQuery({
    queryKey: ['balance'],
    queryFn: () => api<{ usd_balance: number }>('/api/v1/user/balance'),
    refetchInterval: 5_000,
    enabled: session.authed,
  });
}
