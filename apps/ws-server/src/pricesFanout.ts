import { logger } from '@exness/logger';
import { ASSET_DECIMALS, type Symbol } from '@exness/shared';
import { toApi } from '@exness/money';
import type { Redis } from 'ioredis';
import type { SubscriptionRegistry } from './subscriptions.js';

const MAX_BUFFER = 1_000_000;

export function startPricesFanout(redis: Redis, reg: SubscriptionRegistry): void {
  redis.psubscribe('prices:*', (err) => {
    if (err) logger.error({ err }, 'psubscribe failed');
  });
  redis.on('pmessage', (_pattern, channel, raw) => {
    const sym = channel.split(':')[1] as Symbol;
    const dec = ASSET_DECIMALS[sym];
    if (!dec) return;
    const parsed = JSON.parse(raw) as { buy: string; sell: string; ts: number };
    const buy = { value: BigInt(parsed.buy), decimals: dec };
    const sell = { value: BigInt(parsed.sell), decimals: dec };

    const frame = JSON.stringify({
      type: 'price_updates',
      price_updates: [
        {
          symbol: sym,
          buyPrice: toApi(buy, dec).value,
          sellPrice: toApi(sell, dec).value,
          decimals: dec,
        },
      ],
    });

    const sockets = reg.socketsForSymbol(sym);
    if (!sockets) return;
    for (const ws of sockets) {
      // Backpressure: drop price updates if socket is overwhelmed
      if (ws.bufferedAmount > MAX_BUFFER) continue;
      ws.send(frame);
    }
  });
}
