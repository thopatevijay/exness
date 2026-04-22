import { env } from '@exness/config';
import { logger } from '@exness/logger';
import { SYMBOLS, type Symbol } from '@exness/shared';
import WebSocket from 'ws';

export type RawBinanceTrade = {
  e: 'trade';
  E: number; // event time
  s: string; // symbol upper "BTCUSDT"
  t: number; // trade id
  p: string; // price
  q: string; // qty
  T: number; // trade time
  m: boolean;
};

const BINANCE_TO_SYMBOL: Record<string, Symbol> = {
  BTCUSDT: 'BTC',
  ETHUSDT: 'ETH',
  SOLUSDT: 'SOL',
};

export type ConnectOptions = {
  onTrade: (sym: Symbol, t: RawBinanceTrade) => void;
};

export function connectBinance(opts: ConnectOptions): { close: () => void } {
  const symbols = env.BINANCE_SYMBOLS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const streams = symbols.map((s) => `${s}@trade`).join('/');
  const url = `${env.BINANCE_WS_URL}?streams=${streams}`;

  let ws: WebSocket | null = null;
  // Initial backoff 100ms — Binance WS drops are typically brief (transient
  // network or their rolling reconnect). Fast recovery minimizes UI blank time.
  let backoffMs = 100;
  let closed = false;

  const open = (): void => {
    logger.info({ url }, 'binance ws connecting');
    ws = new WebSocket(url);

    ws.on('open', () => {
      logger.info('binance ws open');
      backoffMs = 100;
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as { stream?: string; data?: RawBinanceTrade };
        const trade = msg.data;
        if (!trade || trade.e !== 'trade') return;
        const sym = BINANCE_TO_SYMBOL[trade.s];
        if (!sym || !SYMBOLS.includes(sym)) return;
        opts.onTrade(sym, trade);
      } catch (err) {
        logger.warn({ err }, 'failed to parse binance message');
      }
    });

    ws.on('close', (code: number) => {
      logger.warn({ code, backoffMs }, 'binance ws closed');
      if (!closed) setTimeout(open, backoffMs);
      backoffMs = Math.min(backoffMs * 2, 30_000);
    });

    ws.on('error', (err: Error) => {
      logger.error({ err }, 'binance ws error');
    });
  };

  open();

  return {
    close: () => {
      closed = true;
      ws?.close();
    },
  };
}
