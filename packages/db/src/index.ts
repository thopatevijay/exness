import { env } from '@exness/config';
import { PrismaClient } from '@prisma/client';

let cached: PrismaClient | undefined;

export function getDb(): PrismaClient {
  if (!cached) {
    cached = new PrismaClient({
      datasources: { db: { url: env.DATABASE_URL } },
      // Prisma's 'error' level mirrors thrown errors to stderr before the
      // promise rejects. We catch and re-shape them in route handlers + the
      // error middleware, so the built-in stderr line is redundant noise.
      log: env.NODE_ENV === 'development' ? ['warn'] : [],
    });
  }
  return cached;
}

// Runtime re-export so callers can do `err instanceof Prisma.PrismaClientKnownRequestError`.
// The namespace also carries the generated Prisma.* types.
export { Prisma } from '@prisma/client';
