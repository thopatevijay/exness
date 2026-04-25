import type { Side } from '@exness/money';
import type { Symbol } from './symbols.js';

// Two-sided market quote. `ask` is the price a long opens at (= "Buy" button
// in the UI); `bid` is the price a long closes at (= "Sell" button).
// "buy" / "sell" labels are kept on the action verbs (orders.side, OpenTrade)
// but the *quote* fields use the industry-standard ask / bid.
export type PriceUpdate = {
  symbol: Symbol;
  ask: bigint;
  bid: bigint;
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
  openedAt?: Date;
};

export type OrderIndexEvent =
  | { kind: 'add'; order: OpenOrderSnapshot }
  | { kind: 'modify'; order: OpenOrderSnapshot }
  | { kind: 'remove'; orderId: string };
