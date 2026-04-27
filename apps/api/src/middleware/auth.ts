import type { NextFunction, Request, Response } from 'express';
import { logger } from '@exness/logger';
import { verifyAccessToken } from '../auth/jwt.js';
import { redis } from '../lib/redis.js';
import { ApiError } from './error.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
    jti?: string;
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('authorization');
  const cookie = (req as unknown as { cookies?: { token?: string } }).cookies?.token;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookie;
  if (!token) {
    next(new ApiError(401, 'AUTH_REQUIRED', 'No token provided'));
    return;
  }
  try {
    const { sub, jti } = verifyAccessToken(token);

    try {
      const revoked = await redis().get(`revoked:${jti}`);
      if (revoked) {
        next(new ApiError(401, 'AUTH_REQUIRED', 'Token revoked'));
        return;
      }
    } catch (err) {
      logger.warn({ err, jti }, 'denylist check failed; accepting token');
    }
    req.userId = sub;
    req.jti = jti;
    next();
  } catch {
    next(new ApiError(401, 'AUTH_REQUIRED', 'Invalid token'));
  }
}
