import type { Redis } from 'ioredis';
import type { SubscriptionRegistry } from './subscriptions.js';

let redis: Redis | undefined;
let reg: SubscriptionRegistry | undefined;

export function initMetrics(r: Redis, registry: SubscriptionRegistry): void {
  redis = r;
  reg = registry;
  setInterval(flush, 5_000);
}

async function flush(): Promise<void> {
  if (!redis || !reg) return;
  await redis.set('metrics:ws:conns', String(reg.size()));
}
