import type { NextFunction, Request, Response } from 'express';
import { getDb } from '@exness/db';
import { ApiError } from './error.js';

// Gate /admin/* routes behind an explicit `users.is_admin` flag. Must run
// AFTER requireAuth (depends on req.userId).
//
// Why the DB hit per request? The `is_admin` flag could be revoked, and
// we'd rather take the ~1ms lookup than carry a privilege claim in the
// JWT for the lifetime of a 24h token. If this becomes hot we'll cache
// in Redis with a short TTL and invalidate on flag toggle.
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.userId) {
    next(new ApiError(401, 'AUTH_REQUIRED', 'No token provided'));
    return;
  }
  try {
    const user = await getDb().user.findUnique({
      where: { id: req.userId },
      select: { isAdmin: true },
    });
    if (!user || !user.isAdmin) {
      // Use 403 to distinguish from "not signed in" (401). Tells the client
      // their session is valid but the resource is privilege-gated.
      next(new ApiError(403, 'FORBIDDEN', 'Admin only'));
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
