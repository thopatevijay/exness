import { getDb } from '@exness/db';
import type { Symbol } from '@exness/shared';

export type Tick = {
  time: Date;
  asset: Symbol;
  price: bigint;
};

export async function insertTicks(rows: Tick[]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb();
  // Build a single bulk INSERT with VALUES list. ON CONFLICT DO NOTHING for idempotency
  // (ticks_unique_idx is on (time, asset)).
  const placeholders: string[] = [];
  const params: unknown[] = [];
  rows.forEach((r, i) => {
    const base = i * 3;
    placeholders.push(`($${base + 1}::timestamptz, $${base + 2}, $${base + 3}::bigint)`);
    params.push(r.time, r.asset, r.price);
  });
  const sql = `
    INSERT INTO ticks (time, asset, price)
    VALUES ${placeholders.join(',')}
    ON CONFLICT (time, asset) DO NOTHING
  `;
  await db.$executeRawUnsafe(sql, ...params);
}
