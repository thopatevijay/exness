import { env } from '@exness/config';
import { logger } from '@exness/logger';
import { createServer } from 'node:http';
import type { Redis } from 'ioredis';
import { getDriftCount } from './reconciler.js';
import type { OrderIndex } from './index_.js';

export function startHealth(redis: Redis, index: OrderIndex): void {
  const server = createServer((req, res) => {
    if (req.url !== '/health') {
      res.writeHead(404).end();
      return;
    }
    redis
      .ping()
      .then(() => {
        res.writeHead(200, { 'content-type': 'application/json' }).end(
          JSON.stringify({
            service: 'liquidation-worker',
            uptimeSec: Math.floor(process.uptime()),
            checks: { redis: 'ok' },
            indexSize: index.size(),
            reconcilerDrift: getDriftCount(),
          }),
        );
      })
      .catch(() => res.writeHead(503).end());
  });
  server.listen(env.LIQUIDATION_WORKER_HEALTH_PORT, () => {
    logger.info({ port: env.LIQUIDATION_WORKER_HEALTH_PORT }, 'health listening');
  });
}
