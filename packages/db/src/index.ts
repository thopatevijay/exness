import { env } from '@exness/config';
import { PrismaClient } from '@prisma/client';

let cached: PrismaClient | undefined;

export function getDb(): PrismaClient {
  if (!cached) {
    cached = new PrismaClient({
      datasources: { db: { url: env.DATABASE_URL } },
      log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return cached;
}

export type { Prisma } from '@prisma/client';
