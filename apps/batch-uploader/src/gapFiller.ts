// Self-healing gap filler:
//   - On startup: backfill the last 7 days from Binance REST /klines. This
//     is idempotent (ON CONFLICT DO NOTHING) and fills any internal holes
//     that formed while the stack was offline.
//   - Every 60 s: if MAX(time) in ticks is older than 2 min, the live stream
//     has been paused (laptop sleep, binance WS drop). Backfill from the
//     last known tick up to "now - 1 min" and let the live stream reclaim
//     the current bucket.
//
// All inserts use ON CONFLICT (time, asset) DO NOTHING, so overlap with the
// live stream is safe. After inserts, refresh_continuous_aggregate is called
// over the affected window so 1m/5m/15m/1h/1d/1w stay in sync.

import { getDb } from '@exness/db';
import { logger } from '@exness/logger';
import { applySpread } from '@exness/money';
import { ASSET_DECIMALS, SYMBOLS, type Symbol } from '@exness/shared';

const BINANCE_BY_SYMBOL: Record<Symbol, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
};

const STARTUP_BACKFILL_DAYS = 365;
const GAP_THRESHOLD_MS = 2 * 60_000;
const BINANCE_KLINE_PAGE = 1000;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * 60_000;

type RawKline = [
  number, // openTime (ms)
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // closeTime (ms)
  ...unknown[],
];

async function fetchKlines(
  binanceSymbol: string,
  startMs: number,
  endMs: number,
): Promise<RawKline[]> {
  const url =
    `https://api.binance.com/api/v3/klines` +
    `?symbol=${binanceSymbol}` +
    `&interval=1m` +
    `&startTime=${startMs}` +
    `&endTime=${endMs}` +
    `&limit=${BINANCE_KLINE_PAGE}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`binance klines ${res.status} ${res.statusText}`);
  const body = (await res.json()) as RawKline[];
  if (!Array.isArray(body)) throw new Error('binance klines: non-array response');
  return body;
}

async function latestTickTime(asset: Symbol): Promise<Date | null> {
  const rows = await getDb().$queryRawUnsafe<{ t: Date | null }[]>(
    `SELECT MAX(time) AS t FROM ticks WHERE asset = $1`,
    asset,
  );
  return rows[0]?.t ?? null;
}

const QTY_DECIMALS = 8;

async function insertKlinesAsTicks(asset: Symbol, klines: RawKline[]): Promise<number> {
  if (klines.length === 0) return 0;
  const decimals = ASSET_DECIMALS[asset];
  const priceScale = 10 ** decimals;
  const qtyScale = 10 ** QTY_DECIMALS;

  // Each kline becomes 4 synthetic ticks (open, high, low, close) spaced
  // within the minute so the CAGG's FIRST/MAX/MIN/LAST produces a real OHLC
  // candle body instead of a flat line. The kline's total volume is placed
  // on the close tick so SUM(qty) per bucket = full kline volume.
  type Row = { time: Date; priceStr: string; qtyStr: string };
  const rows: Row[] = [];
  for (const k of klines) {
    const openTime = k[0];
    const closeTime = k[6];
    // eslint-disable-next-line no-restricted-syntax -- Binance wire format: string → number at a known decimal scale
    const openNum = Number(k[1]);
    // eslint-disable-next-line no-restricted-syntax -- Binance wire format: string → number at a known decimal scale
    const highNum = Number(k[2]);
    // eslint-disable-next-line no-restricted-syntax -- Binance wire format: string → number at a known decimal scale
    const lowNum = Number(k[3]);
    // eslint-disable-next-line no-restricted-syntax -- Binance wire format: string → number at a known decimal scale
    const closeNum = Number(k[4]);
    // eslint-disable-next-line no-restricted-syntax -- Binance wire format: string → number at a known decimal scale
    const volumeNum = Number(k[5]);
    if (
      !Number.isFinite(openNum) ||
      !Number.isFinite(highNum) ||
      !Number.isFinite(lowNum) ||
      !Number.isFinite(closeNum)
    ) {
      continue;
    }
    // Binance kline prices are real-trade values (≈ mid). We store the BID
    // in ticks so the chart's historical bars match the bid line that the
    // live publisher writes — keeps the chart price consistent with the
    // sidebar's Bid value and Exness's chart-line convention.
    const toPriceInt = (n: number): string => {
      const midScaled = BigInt(Math.round(n * priceScale));
      const { bid } = applySpread({ value: midScaled, decimals });
      return bid.value.toString();
    };
    const volumeInt = Number.isFinite(volumeNum)
      ? BigInt(Math.round(volumeNum * qtyScale)).toString()
      : '0';
    rows.push({ time: new Date(openTime), priceStr: toPriceInt(openNum), qtyStr: '0' });
    rows.push({
      time: new Date(openTime + 15_000),
      priceStr: toPriceInt(highNum),
      qtyStr: '0',
    });
    rows.push({
      time: new Date(openTime + 30_000),
      priceStr: toPriceInt(lowNum),
      qtyStr: '0',
    });
    rows.push({ time: new Date(closeTime), priceStr: toPriceInt(closeNum), qtyStr: volumeInt });
  }
  if (rows.length === 0) return 0;

  // Postgres bind-variable cap is 32767. Keep chunks well under that (4 params/row).
  const CHUNK_ROWS = 2_000;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK_ROWS) {
    const slice = rows.slice(i, i + CHUNK_ROWS);
    const placeholders: string[] = [];
    const params: unknown[] = [];
    slice.forEach((r, j) => {
      const base = j * 4;
      placeholders.push(
        `($${base + 1}::timestamptz, $${base + 2}, $${base + 3}::bigint, $${base + 4}::bigint)`,
      );
      params.push(r.time, asset, r.priceStr, r.qtyStr);
    });
    const sql = `
      INSERT INTO ticks (time, asset, price, qty)
      VALUES ${placeholders.join(',')}
      ON CONFLICT (time, asset) DO NOTHING
    `;
    await getDb().$executeRawUnsafe(sql, ...params);
    inserted += slice.length;
  }
  return inserted;
}

async function refreshCaggs(fromMs: number, toMs: number): Promise<void> {
  // Extend the refresh window to cover bucket alignment (weekly bucket spans 7d).
  const from = new Date(fromMs - 7 * MS_PER_DAY);
  const to = new Date(toMs + MS_PER_MINUTE);
  const views = ['candles_1m', 'candles_5m', 'candles_15m', 'candles_1h', 'candles_1d', 'candles_1w'];
  for (const v of views) {
    try {
      await getDb().$executeRawUnsafe(
        `CALL refresh_continuous_aggregate($1::regclass, $2::timestamptz, $3::timestamptz)`,
        v,
        from,
        to,
      );
    } catch (err) {
      logger.warn({ err, v }, 'cagg refresh failed');
    }
  }
}

async function backfillWindow(asset: Symbol, fromMs: number, toMs: number): Promise<number> {
  const binanceSymbol = BINANCE_BY_SYMBOL[asset];
  let cursor = fromMs;
  let total = 0;
  while (cursor < toMs) {
    const pageEnd = Math.min(cursor + BINANCE_KLINE_PAGE * MS_PER_MINUTE, toMs);
    let klines: RawKline[];
    try {
      klines = await fetchKlines(binanceSymbol, cursor, pageEnd);
    } catch (err) {
      logger.error({ err, asset }, 'binance klines fetch failed, aborting this pass');
      break;
    }
    if (klines.length === 0) break;
    total += await insertKlinesAsTicks(asset, klines);
    const lastCloseTime = klines[klines.length - 1]?.[6];
    if (!lastCloseTime || lastCloseTime <= cursor) break;
    cursor = lastCloseTime + 1;
  }
  return total;
}

let running = false;

export async function runStartupBackfill(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    const from = now - STARTUP_BACKFILL_DAYS * MS_PER_DAY;
    const to = now - MS_PER_MINUTE;
    let total = 0;
    for (const asset of SYMBOLS) {
      const n = await backfillWindow(asset, from, to);
      if (n > 0) logger.info({ asset, inserted: n }, 'startup gap-fill: inserted ticks');
      total += n;
    }
    if (total > 0) {
      await refreshCaggs(from, to);
      logger.info({ inserted: total, days: STARTUP_BACKFILL_DAYS }, 'startup gap-fill complete');
    } else {
      logger.info({ days: STARTUP_BACKFILL_DAYS }, 'startup gap-fill: nothing to insert');
    }
  } finally {
    running = false;
  }
}

async function runPeriodicCatchUp(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    const ceiling = now - MS_PER_MINUTE;
    let windowStart = ceiling;
    let total = 0;
    for (const asset of SYMBOLS) {
      const latest = await latestTickTime(asset);
      if (!latest) continue;
      const gapMs = now - latest.getTime();
      if (gapMs < GAP_THRESHOLD_MS) continue;
      const from = latest.getTime() + 1;
      if (from >= ceiling) continue;
      const n = await backfillWindow(asset, from, ceiling);
      if (n > 0) {
        logger.info({ asset, inserted: n, gapMin: Math.round(gapMs / 60_000) }, 'catch-up gap-fill');
        total += n;
        if (from < windowStart) windowStart = from;
      }
    }
    if (total > 0) {
      await refreshCaggs(windowStart, now);
    }
  } finally {
    running = false;
  }
}

export function startGapFiller(): void {
  void runStartupBackfill().catch((err) => {
    logger.error({ err }, 'gap-fill startup pass failed');
  });
  setInterval(() => {
    void runPeriodicCatchUp().catch((err) => {
      logger.error({ err }, 'gap-fill periodic pass failed');
    });
  }, 60_000);
}
