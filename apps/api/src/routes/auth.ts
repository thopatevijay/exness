import { env } from '@exness/config';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE_MS,
  ACCESS_COOKIE_PATH,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_PATH,
} from '../auth/cookies.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../auth/jwt.js';
import { redis } from '../lib/redis.js';
import { ApiError } from '../middleware/error.js';

const WS_TICKET_TTL_SEC = 5;

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
  const secure = env.NODE_ENV === 'production';
  res.cookie(ACCESS_COOKIE, access, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: ACCESS_COOKIE_MAX_AGE_MS,
    path: ACCESS_COOKIE_PATH,
  });
  res.cookie(REFRESH_COOKIE, refresh, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: REFRESH_COOKIE_PATH,
  });
}

function readCookie(req: Request, name: string): string | null {
  return (
    (req as unknown as { cookies?: Record<string, string> }).cookies?.[name] ?? null
  );
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const cookieToken = readCookie(req, REFRESH_COOKIE);
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
  const accessHeader = req.header('authorization');
  const accessCookie = readCookie(req, ACCESS_COOKIE);
  const accessToken = accessHeader?.startsWith('Bearer ')
    ? accessHeader.slice(7)
    : accessCookie;
  const refreshCookie = readCookie(req, REFRESH_COOKIE);

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

  res.clearCookie(ACCESS_COOKIE, { path: ACCESS_COOKIE_PATH });
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  res.status(200).json({ ok: true });
}

export async function wsTicket(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) throw new ApiError(401, 'AUTH_REQUIRED', 'No user');
  const ticket = randomUUID();
  await redis().set(`ws-ticket:${ticket}`, userId, 'EX', WS_TICKET_TTL_SEC);
  res.status(200).json({ ticket });
}
