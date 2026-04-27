import { env } from '@exness/config';
import { getDb } from '@exness/db';
import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { signAccessToken, signRefreshToken } from './jwt.js';

const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Equalizes signin time when no user matches; prevents email enumeration via timing.
const DUMMY_HASH = bcrypt.hashSync('dummy', 12);

export async function signin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const user = await getDb().user.findUnique({ where: { email } });
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) {
    res.status(403).json({ message: 'Incorrect credentials' });
    return;
  }
  const access = signAccessToken(user.id);
  const refresh = signRefreshToken(user.id);

  // Cookies are set on the api domain for non-browser clients (tests,
  // direct-api calls). Browser sessions go through the web proxy which
  // sets cookies on the web origin instead.
  res.cookie('token', access.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: ACCESS_COOKIE_MAX_AGE_MS,
    path: '/',
  });
  res.cookie('refresh-token', refresh.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    // Path-scope so the refresh cookie is only sent to the rotation
    // endpoint, never on regular api requests.
    path: '/api/v1/auth/refresh',
  });
  res.status(200).json({ token: access.token, refreshToken: refresh.token });
}
