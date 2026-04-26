import { ASSET_DECIMALS, type Symbol } from '@exness/shared';
import type { Redis } from 'ioredis';
import { ApiError } from '../middleware/error.js';

export type LatestPrice = { ask: bigint; bid: bigint; decimals: number; ts: number };

/**
 * Fetches the latest price for an asset with a two-tier fallback:
 *   1. `latest:<asset>` — fresh key written by price-poller with 5-min TTL.
 *   2. `last:<asset>`   — persistent fallback (no TTL) so long outages
 *                          don't blank out the UI. Callers that need a fresh
 *                          price (trade open/close) should gate with `requireFresh`.
 *
 * Throws `PRICE_UNAVAILABLE` only if neither key exists (never-seen asset,
 * cold boot, or both Redis + DB emptied).
 */
export async function getLatestPrice(redis: Redis, asset: Symbol): Promise<LatestPrice> {
  let raw = await redis.get(`latest:${asset}`);
  if (!raw) raw = await redis.get(`last:${asset}`);
  if (!raw) throw new ApiError(503, 'PRICE_UNAVAILABLE', `no price history for ${asset}`);
  const parsed = JSON.parse(raw) as {
    ask?: string;
    bid?: string;
    decimals?: number;
    ts: number;
  };
  if (!parsed.ask || !parsed.bid) {
    throw new ApiError(503, 'PRICE_UNAVAILABLE', `corrupt cached price for ${asset}`);
  }
  return {
    ask: BigInt(parsed.ask),
    bid: BigInt(parsed.bid),
    decimals: parsed.decimals ?? ASSET_DECIMALS[asset],
    ts: parsed.ts,
  };
}

/**
 * Enforce that a price is fresh enough to trade against. Used by `/trade` and
 * `/trade/:id/close` so we never open or settle a position against a
 * possibly-minutes-old last-known value.
 */
export function requireFresh(price: LatestPrice, maxAgeMs: number): void {
  const age = Date.now() - price.ts;
  if (age > maxAgeMs) {
    throw new ApiError(
      503,
      'PRICE_UNAVAILABLE',
      `price is stale (${age}ms old, max ${maxAgeMs}ms) — wait for feed to reconnect`,
    );
  }
}
