import { getDb } from '@exness/db';
import type { Symbol } from '@exness/shared';

export type Tick = {
  time: Date;
  asset: Symbol;
  price: bigint;
  qty: bigint;
};

// Postgres bind-variable cap is 32767 per prepared statement. With 4 params/row
// we cap chunks at ~8k rows to stay well under that on large backlogs.
const CHUNK = 8_000;

export async function insertTicks(rows: Tick[]): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await insertChunk(rows.slice(i, i + CHUNK));
  }
}

async function insertChunk(rows: Tick[]): Promise<void> {
  const db = getDb();
  const placeholders: string[] = [];
  const params: unknown[] = [];
  rows.forEach((r, i) => {
    const base = i * 4;
    placeholders.push(
      `($${base + 1}::timestamptz, $${base + 2}, $${base + 3}::bigint, $${base + 4}::bigint)`,
    );
    params.push(r.time, r.asset, r.price, r.qty);
  });
  const sql = `
    INSERT INTO ticks (time, asset, price, qty)
    VALUES ${placeholders.join(',')}
    ON CONFLICT (time, asset) DO NOTHING
  `;
  await db.$executeRawUnsafe(sql, ...params);
}
