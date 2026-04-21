import type { Redis } from 'ioredis';

let redis: Redis | undefined;
let inserts = 0;

export function initMetrics(r: Redis): void {
  redis = r;
  setInterval(flush, 5_000);
}

export function recordInserts(n: number): void {
  inserts += n;
}

async function flush(): Promise<void> {
  if (!redis || inserts === 0) return;
  const n = inserts;
  inserts = 0;
  await redis.hincrby('metrics:uploader', 'ticksInsertedTotal', n);
}
