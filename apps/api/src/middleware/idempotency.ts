// Client can send `Idempotency-Key: <client-uuid>` on mutating POSTs.
// First request runs the handler normally and the response ({status, body})
// is cached in Redis under `idem:{userId}:{key}` with a 1h TTL. Subsequent
// requests with the same key replay the cached response byte-for-byte, so
// retries after a flaky network don't double-open positions.
//
// Scoped per user (cache key includes req.userId) so two users cannot collide
// on the same human-readable key. Must run AFTER requireAuth.
//
// Note: concurrent duplicates (same key, arriving near-simultaneously) can
// still race — both miss cache, both run the handler. For V0 we accept this:
// idempotency here is about network-retry safety, not multi-leader serializ-
// ation. Add a Redis SETNX lock if this becomes a real issue.

import type { NextFunction, Request, Response } from 'express';
import { logger } from '@exness/logger';
import { redis } from '../lib/redis.js';

const TTL_SEC = 3600;

export async function idempotency(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const rawKey = req.header('idempotency-key');
  const userId = req.userId;
  if (!rawKey || !userId) return next();

  // Guard: same shape rule as x-request-id middleware.
  if (!/^[\w-]{6,128}$/.test(rawKey)) return next();

  const cacheKey = `idem:${userId}:${rawKey}`;
  try {
    const cached = await redis().get(cacheKey);
    if (cached) {
      const { status, body } = JSON.parse(cached) as { status: number; body: unknown };
      res.status(status).json(body);
      return;
    }
  } catch (err) {
    logger.warn({ err, cacheKey }, 'idempotency cache read failed; falling through');
  }

  const origJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    try {
      const serialized = JSON.stringify({ status: res.statusCode, body });
      void redis()
        .set(cacheKey, serialized, 'EX', TTL_SEC)
        .catch((err: unknown) => logger.warn({ err, cacheKey }, 'idempotency cache write failed'));
    } catch (err) {
      logger.warn({ err, cacheKey }, 'idempotency cache serialize failed');
    }
    return origJson(body);
  }) as typeof res.json;

  next();
}
