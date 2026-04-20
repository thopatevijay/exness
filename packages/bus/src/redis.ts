import { env } from '@exness/config';
import { logger } from '@exness/logger';
import { Redis } from 'ioredis';

export type RedisClient = Redis;

export function createRedis(): Redis {
  const r = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  r.on('error', (err: Error) => logger.error({ err }, 'redis error'));
  r.on('connect', () => logger.info('redis connected'));
  return r;
}
