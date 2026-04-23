'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type OpenInput = {
  asset: 'BTC' | 'ETH' | 'SOL';
  type: 'buy' | 'sell';
  margin: number;
  leverage: 1 | 5 | 10 | 20 | 100;
  stopLoss?: number;
  takeProfit?: number;
};

export function useOpenTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OpenInput) =>
      api<{ orderId: string; openPrice: number; liquidationPrice: number; decimals: number }>(
        '/api/v1/trade',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['open-orders'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
    },
  });
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
