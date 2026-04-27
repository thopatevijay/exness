import type { NextFunction, Request, Response } from 'express';
import { logger } from '@exness/logger';
import { ACCESS_COOKIE } from '../auth/cookies.js';
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
  const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
  const cookie = cookies?.[ACCESS_COOKIE] ?? cookies?.['token'];
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
