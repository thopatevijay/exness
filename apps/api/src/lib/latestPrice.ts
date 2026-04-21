import { ASSET_DECIMALS, type Symbol } from '@exness/shared';
import type { Redis } from 'ioredis';
import { ApiError } from '../middleware/error.js';

export type LatestPrice = { buy: bigint; sell: bigint; decimals: number; ts: number };

export async function getLatestPrice(redis: Redis, asset: Symbol): Promise<LatestPrice> {
  const raw = await redis.get(`latest:${asset}`);
  if (!raw) throw new ApiError(503, 'PRICE_UNAVAILABLE', `no live price for ${asset}`);
  const parsed = JSON.parse(raw) as { buy: string; sell: string; decimals?: number; ts: number };
  return {
    buy: BigInt(parsed.buy),
    sell: BigInt(parsed.sell),
    decimals: parsed.decimals ?? ASSET_DECIMALS[asset],
    ts: parsed.ts,
  };
}
