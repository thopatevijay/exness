import { Prisma, getDb } from '@exness/db';
import { INITIAL_BALANCE } from '@exness/money';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { ApiError } from '../middleware/error.js';
import { isBreached } from './breachCheck.js';

export async function signup(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  const breach = await isBreached(password);
  if (breach.breached) {
    throw new ApiError(
      400,
      'BREACHED_PASSWORD',
      `This password appears in ${breach.count.toLocaleString()} known breaches. Please choose a different one.`,
    );
  }

  const db = getDb();
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email, passwordHash } });
      await tx.balance.create({
        data: { userId: u.id, usdBalance: INITIAL_BALANCE.value },
      });
      return u;
    });
    res.status(201).json({ userId: user.id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, 'USER_EXISTS', 'A user with this email already exists');
    }
    throw err;
  }
}
