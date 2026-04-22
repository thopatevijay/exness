'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { lookbackMs, type TF_MS } from '@/lib/tfMs';

export type Candle = {
  timestamp: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  decimal: number;
};

export function useCandles(asset: string, ts: keyof typeof TF_MS) {
  return useQuery({
    queryKey: ['candles', asset, ts],
    queryFn: () => {
      const now = Date.now();
      const start = now - lookbackMs(ts);
      return api<{ candles: Candle[] }>(
        `/api/v1/candles?asset=${asset}&startTime=${start}&endTime=${now}&ts=${ts}`,
      );
    },
    refetchInterval: 30_000,
  });
}
