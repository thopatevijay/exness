'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { SYMBOLS, type Symbol } from '@exness/shared';
import { WS_URL } from '@/lib/env';
import { wasLocal } from '@/lib/requestIdMemory';
import { usePricesStore } from '@/store/prices';

type WsMessage =
  | {
      type: 'price_updates';
      price_updates: {
        symbol: Symbol;
        buyPrice: number;
        sellPrice: number;
        decimals: number;
      }[];
    }
  | {
      type: 'order_update';
      event: 'opened' | 'closed';
      orderId: string;
      closeReason: string | null;
      pnl: number | null;
      requestId: string | null;
    }
  | { type: 'welcome'; userId: string; serverTime: number }
  | { type: 'pong'; ts: number }
  | { type: 'error'; code: string; message: string };

export function useExnessSocket(): void {
  const qc = useQueryClient();
  const setPrice = usePricesStore((s) => s.setPrice);
  const setWsLatency = usePricesStore((s) => s.setWsLatency);
  const setWsConnected = usePricesStore((s) => s.setWsConnected);
  const reset = usePricesStore((s) => s.reset);
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1_000);
  const closedRef = useRef(false);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    closedRef.current = false;

    const connect = async (): Promise<void> => {
      let token: string | null = null;
      try {
        const r = await fetch('/api/auth/token');
        if (r.ok) {
          const body = (await r.json()) as { token: string | null };
          token = body.token;
        }
      } catch {
        // ignore — fall through to the "no token" branch below
      }
      if (!token) return; // not signed in

      const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        backoffRef.current = 1_000;
        setWsConnected(Date.now());
        ws.send(JSON.stringify({ type: 'subscribe', assets: SYMBOLS }));
        // Gap-fill: after a reconnect, refetch all stateful queries in case we
        // missed an order_update while the socket was down.
        qc.invalidateQueries({ queryKey: ['balance'] });
        qc.invalidateQueries({ queryKey: ['open-orders'] });
        qc.invalidateQueries({ queryKey: ['closed-orders'] });
        if (pingRef.current) clearInterval(pingRef.current);
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
          }
        }, 5_000);
      });

      ws.addEventListener('message', (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as WsMessage;

          if (msg.type === 'price_updates') {
            const now = Date.now();
            for (const u of msg.price_updates) {
              setPrice(u.symbol, {
                buy: u.buyPrice,
                sell: u.sellPrice,
                decimals: u.decimals,
                ts: now,
              });
            }
          } else if (msg.type === 'order_update') {
            qc.invalidateQueries({ queryKey: ['open-orders'] });
            qc.invalidateQueries({ queryKey: ['closed-orders'] });
            qc.invalidateQueries({ queryKey: ['balance'] });
            const localEcho = wasLocal(msg.requestId);
            if (msg.event === 'opened' && !localEcho) {
              toast.success('Order opened (from another session)');
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
          } else if (msg.type === 'pong') {
            setWsLatency(Date.now() - msg.ts);
          } else if (msg.type === 'error') {
            toast.error(msg.message);
          }
        } catch {
          // ignore unparseable frames
        }
      });

      ws.addEventListener('close', () => {
        wsRef.current = null;
        if (pingRef.current) {
          clearInterval(pingRef.current);
          pingRef.current = null;
        }
        if (closedRef.current) return;
        const delay = backoffRef.current;
        backoffRef.current = Math.min(backoffRef.current * 2, 30_000);
        setTimeout(() => void connect(), delay);
      });

      ws.addEventListener('error', () => {
        // Force close → triggers reconnect via the close handler.
        ws.close();
      });
    };

    void connect();

    return () => {
      closedRef.current = true;
      if (pingRef.current) {
        clearInterval(pingRef.current);
        pingRef.current = null;
      }
      wsRef.current?.close();
      reset();
    };
  }, [qc, setPrice, setWsLatency, setWsConnected, reset]);
}
