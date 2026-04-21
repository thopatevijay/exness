import type { Side } from '@exness/money';
import type { Symbol } from '@exness/shared';

export type IndexedOrder = {
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
  openedAt: Date;
};

type Bucket = Map<string, IndexedOrder>; // orderId → order

export class OrderIndex {
  private buckets = new Map<string, Bucket>();

  private key(asset: Symbol, side: Side): string {
    return `${asset}:${side}`;
  }

  add(o: IndexedOrder): void {
    const k = this.key(o.asset, o.side);
    if (!this.buckets.has(k)) this.buckets.set(k, new Map());
    this.buckets.get(k)!.set(o.orderId, o);
  }

  remove(orderId: string): void {
    for (const bucket of this.buckets.values()) bucket.delete(orderId);
  }

  iterate(asset: Symbol, side: Side): Iterable<IndexedOrder> {
    return this.buckets.get(this.key(asset, side))?.values() ?? [];
  }

  has(orderId: string): boolean {
    for (const bucket of this.buckets.values()) {
      if (bucket.has(orderId)) return true;
    }
    return false;
  }

  size(): number {
    let n = 0;
    for (const b of this.buckets.values()) n += b.size;
    return n;
  }

  clear(): void {
    this.buckets.clear();
  }
}
