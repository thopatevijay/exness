'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { SYMBOLS, type Symbol } from '@exness/shared';
import { WS_URL } from '@/lib/env';
import { wasLocal } from '@/lib/requestIdMemory';
import { usePricesStore, type LivePrice } from '@/store/prices';

type WsMessage =
  | {
      type: 'price_updates';
      price_updates: {
        symbol: Symbol;
        ask: number;
        bid: number;
        decimals: number;
      }[];
    }
  | {
      type: 'order_update';
      event: 'opened' | 'closed' | 'modified';
      orderId: string;
      closeReason: string | null;
      pnl: number | null;
      stopLoss: number | null;
      takeProfit: number | null;
      requestId: string | null;
    }
  | { type: 'welcome'; userId: string; serverTime: number }
  | { type: 'error'; code: string; message: string };

export function useExnessSocket(): void {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1_000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generationRef = useRef(0);

  useEffect(() => {
    generationRef.current += 1;
    const myGen = generationRef.current;

    const { setPrices, reset } = usePricesStore.getState();

    const pending = new Map<Symbol, LivePrice>();
    let rafId: number | null = null;
    const queueUpdates = (updates: Array<[Symbol, LivePrice]>): void => {
      for (const [s, p] of updates) pending.set(s, p);
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (pending.size === 0) return;
        const drained = Array.from(pending.entries());
        pending.clear();
        setPrices(drained);
      });
    };

    const connect = async (): Promise<void> => {
      if (myGen !== generationRef.current) return; // a newer effect run owns the socket
      let token: string | null = null;
      try {
        const r = await fetch('/api/auth/token');
        if (r.ok) {
          const body = (await r.json()) as { token: string | null };
          token = body.token;
        }
      } catch {
      }
      if (myGen !== generationRef.current) return; // bailed during async fetch


      const url = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        backoffRef.current = 1_000;
        ws.send(JSON.stringify({ type: 'subscribe', assets: SYMBOLS }));
        // Gap-fill: after a reconnect, refetch all stateful queries in case we
        // missed an order_update while the socket was down.
        qc.invalidateQueries({ queryKey: ['balance'] });
        qc.invalidateQueries({ queryKey: ['open-orders'] });
        qc.invalidateQueries({ queryKey: ['closed-orders'] });
      });

      ws.addEventListener('message', (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as WsMessage;

          if (msg.type === 'price_updates') {
            const now = Date.now();
            queueUpdates(
              msg.price_updates.map((u) => [
                u.symbol,
                { ask: u.ask, bid: u.bid, decimals: u.decimals, ts: now },
              ]),
            );
          } else if (msg.type === 'order_update') {
            qc.invalidateQueries({ queryKey: ['open-orders'] });
            qc.invalidateQueries({ queryKey: ['closed-orders'] });
            qc.invalidateQueries({ queryKey: ['balance'] });
            const localEcho = wasLocal(msg.requestId);
            if (msg.event === 'opened' && !localEcho) {
              toast.success('Order opened (from another session)');
            }
            if (msg.event === 'modified' && !localEcho) {
              toast.info(`Position ${msg.orderId.slice(0, 8)} modified`);
            }
            if (msg.event === 'closed') {
              const reason = msg.closeReason ?? '';
              const pnl = msg.pnl ?? 0;
              const sign = pnl >= 0 ? '+' : '';
              const fmt = (Math.abs(pnl) / 100).toFixed(2);
              if (reason === 'liquidation') {
                toast.error(`Liquidated — pnl ${sign}$${fmt}`);
              } else if (reason === 'sl') {
                toast.warning(`Stop loss hit — pnl ${sign}$${fmt}`);
              } else if (reason === 'tp') {
                toast.success(`Take profit hit — pnl ${sign}$${fmt}`);
              } else if (reason === 'manual' && !localEcho) {
                toast.info(`Order closed (from another session) — pnl ${sign}$${fmt}`);
              }
            }
          } else if (msg.type === 'error') {
            toast.error(msg.message);
          }
        } catch {
          // ignore unparseable frames
        }
      });

      ws.addEventListener('close', () => {
        if (myGen !== generationRef.current) return;
        wsRef.current = null;
        const delay = backoffRef.current;
        backoffRef.current = Math.min(backoffRef.current * 2, 30_000);
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (myGen !== generationRef.current) return;
          void connect();
        }, delay);
      });

      ws.addEventListener('error', () => {
        // Force close → triggers reconnect via the close handler.
        ws.close();
      });
    };

    void connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
      reset();
    };
  }, [qc]);
}
