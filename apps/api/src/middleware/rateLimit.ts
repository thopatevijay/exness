import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request, RequestHandler } from 'express';

export function userRateLimit(opts: { limit: number; windowMs: number }): RequestHandler {
  return rateLimit({
    limit: opts.limit,
    windowMs: opts.windowMs,
    keyGenerator: (req: Request) =>
      req.userId ?? (req.ip ? ipKeyGenerator(req.ip) : 'anon'),
    standardHeaders: true,
    legacyHeaders: false,
  });
}

export function ipRateLimit(opts: { limit: number; windowMs: number }): RequestHandler {
  return rateLimit({
    limit: opts.limit,
    windowMs: opts.windowMs,
    standardHeaders: true,
    legacyHeaders: false,
  });
}
