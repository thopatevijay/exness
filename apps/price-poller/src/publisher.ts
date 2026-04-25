import type { Redis } from 'ioredis';
import { applySpread, parseBinancePrice } from '@exness/money';
import { ASSET_DECIMALS, type Symbol } from '@exness/shared';
import type { RawBinanceTrade } from './binance.js';

const STREAM_MAXLEN = 100_000;
// Binance sends quantities at 8 decimals on the wire; keep that as the qty precision.
const QTY_DECIMALS = 8;

export async function publishTrade(redis: Redis, sym: Symbol, t: RawBinanceTrade): Promise<void> {
  const assetDecimals = ASSET_DECIMALS[sym];
  const mid = parseBinancePrice(t.p, assetDecimals);
  const { ask, bid } = applySpread(mid);
  const ts = t.T;

  const priceUpdate = JSON.stringify({
    symbol: sym,
    ask: ask.value.toString(),
    bid: bid.value.toString(),
    decimals: assetDecimals,
    ts,
  });
  const latestPayload = JSON.stringify({
    ask: ask.value.toString(),
    bid: bid.value.toString(),
    decimals: assetDecimals,
    ts,
  });

  const pipeline = redis.multi();
  pipeline.publish(`prices:${sym}`, priceUpdate);
  // Stream the BID into trades:* so the chart's historical bars (ticks →
  // CAGGs) match the bid price visible in the UI's sidebar / order panel.
  // Matches Exness's chart-line convention. Open / close trade math still
  // uses the full {ask, bid} pair from latest:* (handled elsewhere).
  pipeline.xadd(
    `trades:${sym}`,
    'MAXLEN',
    '~',
    String(STREAM_MAXLEN),
    '*',
    'symbol',
    sym,
    'price',
    bid.value.toString(),
    'qty',
    parseBinancePrice(t.q, QTY_DECIMALS).value.toString(),
    'ts',
    String(ts),
  );
  // Two price keys:
  //   `latest:*` — 5-min TTL, signals liveness. Fresh if < 5 s old.
  //   `last:*`   — no TTL, persistent last-known value. Used as fallback
  //                when `latest:*` expires during a longer outage so the UI
  //                shows *something* (with a stale indicator) instead of
  //                blanking out every panel.
  pipeline.set(`latest:${sym}`, latestPayload, 'EX', 300);
  pipeline.set(`last:${sym}`, latestPayload);
  await pipeline.exec();
}
