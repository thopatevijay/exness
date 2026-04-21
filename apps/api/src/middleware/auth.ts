import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../auth/jwt.js';
import { ApiError } from './error.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const cookie = (req as unknown as { cookies?: { token?: string } }).cookies?.token;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookie;
  if (!token) {
    next(new ApiError(401, 'AUTH_REQUIRED', 'No token provided'));
    return;
  }
  try {
    const { sub } = verifyToken(token);
    req.userId = sub;
    next();
  } catch {
    next(new ApiError(401, 'AUTH_REQUIRED', 'Invalid token'));
  }
}
