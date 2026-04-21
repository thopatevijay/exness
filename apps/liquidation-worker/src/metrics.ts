import type { Redis } from 'ioredis';
import type { OrderIndex } from './index_.js';
import { getDriftCount } from './reconciler.js';

let redis: Redis | undefined;
let index: OrderIndex | undefined;

export function initMetrics(r: Redis, idx: OrderIndex): void {
  redis = r;
  index = idx;
  setInterval(flush, 5_000);
}

async function flush(): Promise<void> {
  if (!redis || !index) return;
  await redis
    .multi()
    .set('metrics:liq:indexSize', String(index.size()))
    .set('metrics:liq:driftTotal', String(getDriftCount()))
    .exec();
}
