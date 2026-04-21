import { createRedis } from '@exness/bus';
import type { Redis } from 'ioredis';

let cached: Redis | undefined;

export function redis(): Redis {
  if (!cached) cached = createRedis();
  return cached;
}
