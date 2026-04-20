import type { Redis } from 'ioredis';

export type StreamEntry = { id: string; data: Record<string, string> };

export async function ensureGroup(
  redis: Redis,
  stream: string,
  group: string,
): Promise<void> {
  try {
    await redis.xgroup('CREATE', stream, group, '$', 'MKSTREAM');
  } catch (err) {
    const msg = (err as Error).message;
    if (!msg.includes('BUSYGROUP')) throw err;
  }
}

export async function readGroup(
  redis: Redis,
  group: string,
  consumer: string,
  streams: string[],
  count: number,
  blockMs: number,
): Promise<StreamEntry[]> {
  const args: (string | number)[] = [
    'GROUP',
    group,
    consumer,
    'COUNT',
    count,
    'BLOCK',
    blockMs,
    'STREAMS',
  ];
  for (const s of streams) args.push(s);
  for (let i = 0; i < streams.length; i++) args.push('>');
  const result = (await (
    redis as unknown as { call: (...a: unknown[]) => Promise<unknown> }
  ).call('XREADGROUP', ...args)) as [string, [string, string[]][]][] | null;

  if (!result) return [];
  const entries: StreamEntry[] = [];
  for (const [, msgs] of result) {
    for (const [id, fields] of msgs) {
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]!] = fields[i + 1]!;
      }
      entries.push({ id, data });
    }
  }
  return entries;
}
