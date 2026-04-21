import { Prisma, getDb } from '@exness/db';
import { INITIAL_BALANCE } from '@exness/money';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { ApiError } from '../middleware/error.js';

export async function signup(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
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
    // P2002 = unique constraint violation. The only unique field on users is email.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, 'USER_EXISTS', 'A user with this email already exists');
    }
    // Anything else falls through to the error middleware (500 INTERNAL_ERROR).
    throw err;
  }
}
