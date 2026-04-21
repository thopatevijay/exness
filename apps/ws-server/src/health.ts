import { env } from '@exness/config';
import { logger } from '@exness/logger';
import { createServer } from 'node:http';
import type { Redis } from 'ioredis';
import type { SubscriptionRegistry } from './subscriptions.js';

export function startHealth(redis: Redis, reg: SubscriptionRegistry): void {
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
            service: 'ws-server',
            uptimeSec: Math.floor(process.uptime()),
            checks: { redis: 'ok' },
            connections: reg.size(),
          }),
        );
      })
      .catch(() => res.writeHead(503).end());
  });
  server.listen(env.WS_SERVER_HEALTH_PORT, () => {
    logger.info({ port: env.WS_SERVER_HEALTH_PORT }, 'health listening');
  });
}
