import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: process.env.SERVICE_NAME ?? 'unknown' },
  redact: ['password', 'password_hash', 'token', 'authorization', '*.password'],
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l' },
        },
      }),
});

export function childFor(ctx: { requestId?: string; userId?: string }): pino.Logger {
  return logger.child(ctx);
}

export type Logger = pino.Logger;
