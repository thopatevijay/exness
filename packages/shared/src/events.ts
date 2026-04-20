import type { Side } from '@exness/money';
import type { Symbol } from './symbols.js';

export type PriceUpdate = {
  symbol: Symbol;
  buy: bigint;
  sell: bigint;
  ts: number;
};

export type TradeTick = {
  symbol: Symbol;
  price: bigint;
  qty: bigint;
  ts: number;
};

export type CloseReason = 'manual' | 'sl' | 'tp' | 'liquidation';

export type TradeExecuted =
  | {
      type: 'order_opened';
      orderId: string;
      userId: string;
      asset: Symbol;
      side: Side;
      margin: bigint;
      leverage: number;
      openPrice: bigint;
      liquidationPrice: bigint;
      ts: number;
    }
  | {
      type: 'order_closed';
      orderId: string;
      userId: string;
      asset: Symbol;
      side: Side;
      closePrice: bigint;
      pnl: bigint;
      closeReason: CloseReason;
      ts: number;
    };

export type OpenOrderSnapshot = {
  orderId: string;
  userId: string;
  asset: Symbol;
  side: Side;
  margin: bigint;
  leverage: number;
  openPrice: bigint;
  liquidationPrice: bigint;
  stopLoss: bigint | null;
  takeProfit: bigint | null;
};

export type OrderIndexEvent =
  | { kind: 'add'; order: OpenOrderSnapshot }
  | { kind: 'remove'; orderId: string };
