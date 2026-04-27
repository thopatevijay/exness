
import type { NextFunction, Request, Response } from 'express';
import { logger } from '@exness/logger';
import { redis } from '../lib/redis.js';

const TTL_SEC = 3600;
const LOCK_TTL_MS = 5_000;

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
  const lockKey = `idem-lock:${userId}:${rawKey}`;

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

  let acquired: string | null = null;
  try {
    acquired = (await redis().set(lockKey, '1', 'PX', LOCK_TTL_MS, 'NX')) as string | null;
  } catch (err) {
    logger.warn({ err, lockKey }, 'idempotency lock acquire failed; proceeding without lock');
  }

  if (acquired === null) {
    try {
      const cached = await redis().get(cacheKey);
      if (cached) {
        const { status, body } = JSON.parse(cached) as { status: number; body: unknown };
        res.status(status).json(body);
        return;
      }
    } catch {
      // ignore — fall through to 409
    }
    res.status(409).json({
      error: {
        code: 'IN_FLIGHT',
        message: 'A request with this idempotency key is currently being processed',
      },
    });
    return;
  }

  const origJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    try {
      const serialized = JSON.stringify({ status: res.statusCode, body });
      void redis()
        .set(cacheKey, serialized, 'EX', TTL_SEC)
        .catch((err: unknown) => logger.warn({ err, cacheKey }, 'idempotency cache write failed'));
      void redis()
        .del(lockKey)
        .catch((err: unknown) => logger.warn({ err, lockKey }, 'idempotency lock release failed'));
    } catch (err) {
      logger.warn({ err, cacheKey }, 'idempotency cache serialize failed');
    }
    return origJson(body);
  }) as typeof res.json;

  res.on('close', () => {
    if (!res.headersSent) {
      void redis().del(lockKey).catch(() => undefined);
    }
  });

  next();
}
