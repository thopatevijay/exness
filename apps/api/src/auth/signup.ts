import { getDb } from '@exness/db';
import { INITIAL_BALANCE } from '@exness/money';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';

export async function signup(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const db = getDb();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email, passwordHash } });
      await tx.balance.create({
        data: { userId: u.id, usdBalance: INITIAL_BALANCE.value },
      });
      return u;
    });
    res.status(201).json({ userId: user.id });
  } catch {
    res.status(403).json({ message: 'Error while signing up' });
  }
}
