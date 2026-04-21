import { ensureGroup, readGroup, type StreamEntry } from '@exness/bus';
import { logger } from '@exness/logger';
import { SYMBOLS, type Symbol } from '@exness/shared';
import type { Redis } from 'ioredis';
import { insertTicks, type Tick } from './inserter.js';
import { recordInserts } from './metrics.js';

const GROUP = 'cg:uploader';
// Stable consumer name so pending entries from a crash belong to the same consumer on restart.
const CONSUMER = process.env.HOSTNAME ?? 'batch-uploader';
const BATCH_SIZE = 100;
const FLUSH_MS = 1_000;

type BufferedEntry = { id: string; stream: string; tick: Tick };

export async function runConsumer(redis: Redis): Promise<void> {
  const streams = SYMBOLS.map((s) => `trades:${s}`);
  for (const s of streams) await ensureGroup(redis, s, GROUP);

  let buffer: BufferedEntry[] = [];
  let lastFlush = Date.now();

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return;
    const toFlush = buffer;
    buffer = [];
    try {
      await insertTicks(toFlush.map((b) => b.tick));
      recordInserts(toFlush.length);
      const grouped = new Map<string, string[]>();
      for (const b of toFlush) {
        if (!grouped.has(b.stream)) grouped.set(b.stream, []);
        grouped.get(b.stream)!.push(b.id);
      }
      for (const [stream, ids] of grouped) {
        await redis.xack(stream, GROUP, ...ids);
      }
      logger.info({ count: toFlush.length }, 'flushed batch');
    } catch (err) {
      logger.error({ err, size: toFlush.length }, 'flush failed; messages remain unacked');
      // Don't push back — they remain in PEL and will redeliver via XAUTOCLAIM
    }
    lastFlush = Date.now();
  };

  // Time-based flush ticker
  setInterval(() => {
    if (buffer.length > 0 && Date.now() - lastFlush >= FLUSH_MS) {
      void flush();
    }
  }, 100);

  // First, drain any pending entries from a previous run (PEL for this consumer)
  await drainPending(redis, streams, buffer);

  while (true) {
    const entries = await readGroup(redis, GROUP, CONSUMER, streams, BATCH_SIZE, FLUSH_MS);
    for (const e of entries) {
      const tick = entryToTick(e);
      if (!tick) continue;
      buffer.push({ id: e.id, stream: streamForSymbol(tick.asset), tick });
    }
    if (buffer.length >= BATCH_SIZE) await flush();
  }
}

async function drainPending(
  redis: Redis,
  streams: string[],
  buffer: BufferedEntry[],
): Promise<void> {
  // XREADGROUP with id "0" returns this consumer's pending (unacked) entries
  const args: (string | number)[] = ['GROUP', GROUP, CONSUMER, 'STREAMS'];
  for (const s of streams) args.push(s);
  for (let i = 0; i < streams.length; i++) args.push('0');
  const result = (await (
    redis as unknown as { call: (...a: unknown[]) => Promise<unknown> }
  ).call('XREADGROUP', ...args)) as [string, [string, string[]][]][] | null;
  if (!result) return;
  for (const [stream, msgs] of result) {
    for (const [id, fields] of msgs) {
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) data[fields[i]!] = fields[i + 1]!;
      const tick = entryToTick({ id, data });
      if (tick) buffer.push({ id, stream, tick });
    }
  }
  logger.info({ count: buffer.length }, 'drained pending entries from previous run');
}

function streamForSymbol(sym: Symbol): string {
  return `trades:${sym}`;
}

function entryToTick(entry: StreamEntry): Tick | null {
  const symRaw = entry.data['symbol'];
  const priceRaw = entry.data['price'];
  const tsRaw = entry.data['ts'];
  if (!symRaw || !priceRaw || !tsRaw) return null;
  if (!SYMBOLS.includes(symRaw as Symbol)) return null;
  return {
    // eslint-disable-next-line no-restricted-syntax -- ms timestamp to Date, not monetary
    time: new Date(Number(tsRaw)),
    asset: symRaw as Symbol,
    price: BigInt(priceRaw),
  };
}
