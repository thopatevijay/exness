import { env } from '@exness/config';
import { getDb } from '@exness/db';
import { logger } from '@exness/logger';
import { createServer } from 'node:http';
import type { Redis } from 'ioredis';

export function startHealth(redis: Redis): void {
  const server = createServer((req, res) => {
    if (req.url !== '/health') {
      res.writeHead(404).end();
      return;
    }
    Promise.all([redis.ping(), getDb().$queryRaw`SELECT 1`])
      .then(() => {
        res
          .writeHead(200, { 'content-type': 'application/json' })
          .end(
            JSON.stringify({
              service: 'api',
              uptimeSec: Math.floor(process.uptime()),
              checks: { db: 'ok', redis: 'ok' },
            }),
          );
      })
      .catch((err: unknown) => {
        res.writeHead(503).end(JSON.stringify({ checks: { error: String(err) } }));
      });
  });
  server.listen(env.API_HEALTH_PORT, () => {
    logger.info({ port: env.API_HEALTH_PORT }, 'health listening');
  });
}
