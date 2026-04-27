import { env } from '@exness/config';
import { logger } from '@exness/logger';
import { createServer } from 'node:http';
import type { Redis } from 'ioredis';

export function startHealth(redis: Redis): void {
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
            service: 'notifier',
            uptimeSec: Math.floor(process.uptime()),
            checks: { redis: 'ok' },
            dryRun: env.EMAIL_DRY_RUN === 'true' || env.RESEND_API_KEY === '',
          }),
        );
      })
      .catch((err: unknown) => {
        res.writeHead(503).end(JSON.stringify({ checks: { error: String(err) } }));
      });
  });
  const port = env.NOTIFIER_HEALTH_PORT;
  server.listen(port, () => {
    logger.info({ port }, 'health listening');
  });
}
