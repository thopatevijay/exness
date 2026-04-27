import { env } from '@exness/config';
import { logger } from '@exness/logger';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'node:http';
import { refreshAggregatedMetrics } from './lib/aggregateMetrics.js';
import { errorMiddleware } from './middleware/error.js';
import { requestId } from './middleware/requestId.js';
import { httpRequestDurationMs, registry } from './metrics.js';
import { router } from './routes/index.js';

export function buildServer(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());

  const ALLOWED = env.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || ALLOWED.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      customProps: (req: IncomingMessage) => ({
        requestId: (req as unknown as { requestId: string }).requestId,
      }),
    }),
  );

  app.use((req, res, next) => {
    const start = Date.now();
    res.once('finish', () => {
      httpRequestDurationMs
        .labels(req.path, req.method, String(res.statusCode))
        .observe(Date.now() - start);
    });
    next();
  });

  // Rate limit signin only
  app.use(
    '/api/v1/user/signin',
    rateLimit({ windowMs: 10 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }),
  );

  app.use('/api/v1', router);

  app.get('/metrics', async (_req, res) => {
    try {
      await refreshAggregatedMetrics();
    } catch (err) {
      logger.error({ err }, 'metrics aggregation failed');
    }
    res.set('content-type', registry.contentType);
    res.send(await registry.metrics());
  });

  app.use(errorMiddleware);
  return app;
}

export function startServer(): void {
  const app = buildServer();
  app.listen(env.API_PORT, () => logger.info({ port: env.API_PORT }, 'api listening'));
}
