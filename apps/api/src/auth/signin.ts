import { env } from '@exness/config';
import { getDb } from '@exness/db';
import { logger } from '@exness/logger';
import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { isBreached } from './breachCheck.js';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE_MS,
  ACCESS_COOKIE_PATH,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE_MS,
  REFRESH_COOKIE_PATH,
} from './cookies.js';
import { signAccessToken, signRefreshToken } from './jwt.js';

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
  // Fire-and-forget telemetry; never blocks signin, fails open inside.
  void isBreached(password).then((b) => {
    if (b.breached) {
      logger.warn(
        { userId: user.id, breachCount: b.count },
        'signed in with known-breached password',
      );
    }
  });

  const access = signAccessToken(user.id);
  const refresh = signRefreshToken(user.id);
  const secure = env.NODE_ENV === 'production';

  res.cookie(ACCESS_COOKIE, access.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: ACCESS_COOKIE_MAX_AGE_MS,
    path: ACCESS_COOKIE_PATH,
  });
  res.cookie(REFRESH_COOKIE, refresh.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: REFRESH_COOKIE_PATH,
  });
  res.status(200).json({ token: access.token, refreshToken: refresh.token });
}
