import { getDb } from '@exness/db';
import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { signToken } from './jwt.js';

export async function signin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const db = getDb();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    res.status(403).json({ message: 'Incorrect credentials' });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(403).json({ message: 'Incorrect credentials' });
    return;
  }
  res.status(200).json({ token: signToken(user.id) });
}
