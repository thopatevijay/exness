import { env } from '@exness/config';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../auth/jwt.js';
import { redis } from '../lib/redis.js';
import { ApiError } from '../middleware/error.js';

const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

async function denylist(token: string): Promise<void> {
  const decoded = jwt.decode(token) as { jti?: string; exp?: number } | null;
  if (!decoded?.jti || !decoded.exp) return;
  const ttl = Math.max(decoded.exp - nowSec(), 1);
  await redis().set(`revoked:${decoded.jti}`, '1', 'EX', ttl);
}

function setAuthCookies(res: Response, access: string, refresh: string): void {
  res.cookie('token', access, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: ACCESS_COOKIE_MAX_AGE_MS,
    path: '/',
  });
  res.cookie('refresh-token', refresh, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/v1/auth/refresh',
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const cookieToken =
    (req as unknown as { cookies?: { 'refresh-token'?: string } }).cookies?.[
      'refresh-token'
    ] ?? null;
  // Body fallback for non-browser clients that aren't carrying cookies.
  const bodyToken =
    typeof req.body === 'object' && req.body !== null
      ? (req.body as { refreshToken?: string }).refreshToken
      : undefined;
  const token = cookieToken ?? bodyToken;
  if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Invalid refresh token');
  }

  const revoked = await redis().get(`revoked:${payload.jti}`);
  if (revoked) throw new ApiError(401, 'AUTH_REQUIRED', 'Refresh token revoked');

  const newAccess = signAccessToken(payload.sub);
  const newRefresh = signRefreshToken(payload.sub);
  await denylist(token);

  setAuthCookies(res, newAccess.token, newRefresh.token);
  res.status(200).json({ token: newAccess.token, refreshToken: newRefresh.token });
}

export async function logout(req: Request, res: Response): Promise<void> {
  // Best-effort denylist of whichever tokens are present. We never reject
  // logout on a missing or already-expired token — the user wants out.
  const accessHeader = req.header('authorization');
  const accessCookie =
    (req as unknown as { cookies?: { token?: string } }).cookies?.token ?? null;
  const accessToken = accessHeader?.startsWith('Bearer ')
    ? accessHeader.slice(7)
    : accessCookie;
  const refreshCookie =
    (req as unknown as { cookies?: { 'refresh-token'?: string } }).cookies?.[
      'refresh-token'
    ] ?? null;

  if (accessToken) {
    try {
      verifyAccessToken(accessToken);
      await denylist(accessToken);
    } catch {
      // expired/invalid — nothing useful to denylist
    }
  }
  if (refreshCookie) {
    try {
      verifyRefreshToken(refreshCookie);
      await denylist(refreshCookie);
    } catch {
      // expired/invalid — nothing useful to denylist
    }
  }

  res.clearCookie('token', { path: '/' });
  res.clearCookie('refresh-token', { path: '/api/v1/auth/refresh' });
  res.status(200).json({ ok: true });
}
