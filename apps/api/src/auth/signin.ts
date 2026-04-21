import { env } from '@exness/config';
import { getDb } from '@exness/db';
import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { signToken } from './jwt.js';

export async function signin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const user = await getDb().user.findUnique({ where: { email } });
  if (!user) {
    res.status(403).json({ message: 'Incorrect credentials' });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(403).json({ message: 'Incorrect credentials' });
    return;
  }
  const token = signToken(user.id);
  // Cookie on api domain for non-browser clients (mobile, tests); the web
  // proxies auth through its own routes and sets the cookie on its own origin.
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
  res.status(200).json({ token });
}
