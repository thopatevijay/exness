'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiResponseError, api } from '@/lib/api';

export type OpenInput = {
  asset: 'BTC' | 'ETH' | 'SOL';
  type: 'buy' | 'sell';
  margin: number;
  leverage: 1 | 5 | 10 | 20 | 100;
  stopLoss?: number;
  takeProfit?: number;
};

type OpenResponse = {
  orderId: string;
  openPrice: number;
  liquidationPrice: number;
  decimals: number;
};

export function useOpenTrade() {
  const qc = useQueryClient();
  // Key lives in `variables` so it's stable across retries (react-query feeds
  // the same variables into mutationFn on every retry attempt).
  const base = useMutation({
    mutationFn: ({ input, idemKey }: { input: OpenInput; idemKey: string }) =>
      api<OpenResponse>('/api/v1/trade', {
        method: 'POST',
        headers: { 'idempotency-key': idemKey },
        body: JSON.stringify(input),
      }),
    // Retry ONLY network errors and 5xx; never on 4xx (validation, insufficient
    // balance, stale price). Server-side idempotency makes retries safe — the
    // second attempt with the same idemKey replays the cached response.
    retry: (failureCount, error) => {
      if (failureCount >= 2) return false;
      if (error instanceof ApiResponseError && error.status < 500) return false;
      return true;
    },
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 3000),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['open-orders'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
    },
  });

  return {
    ...base,
    mutate: (input: OpenInput) => base.mutate({ input, idemKey: crypto.randomUUID() }),
    mutateAsync: (input: OpenInput) => base.mutateAsync({ input, idemKey: crypto.randomUUID() }),
  };
}

export function useCloseTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      api<{ orderId: string; pnl: number; balance: number }>(`/api/v1/trade/${orderId}/close`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['open-orders'] });
      qc.invalidateQueries({ queryKey: ['closed-orders'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export type ModifyInput = {
  stopLoss?: number | null;
  takeProfit?: number | null;
};

export function useModifyTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, body }: { orderId: string; body: ModifyInput }) =>
      api<{ orderId: string; stopLoss: number | null; takeProfit: number | null; decimals: number }>(
        `/api/v1/trade/${orderId}/modify`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['open-orders'] });
    },
  });
}
