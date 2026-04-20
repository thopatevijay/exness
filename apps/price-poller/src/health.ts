import { env } from '@exness/config';
import { logger } from '@exness/logger';
import { createServer } from 'node:http';
import type { Redis } from 'ioredis';

export function startHealth(redis: Redis, lastTickRef: { ts: number }): void {
  const server = createServer((req, res) => {
    if (req.url !== '/health') {
      res.writeHead(404).end();
      return;
    }
    const stale = Date.now() - lastTickRef.ts;
    void redis
      .ping()
      .then(() => {
        const ok = stale < 30_000;
        res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            service: 'price-poller',
            uptimeSec: Math.floor(process.uptime()),
            checks: {
              redis: 'ok',
              binance_feed_stale_ms: stale,
            },
          }),
        );
      })
      .catch(() => {
        res.writeHead(503).end(JSON.stringify({ checks: { redis: 'fail' } }));
      });
  });
  server.listen(env.PRICE_POLLER_HEALTH_PORT, () => {
    logger.info({ port: env.PRICE_POLLER_HEALTH_PORT }, 'health listening');
  });
}
