import 'dotenv/config';
import { cleanEnv, port, str, url } from 'envalid';

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  LOG_LEVEL: str({ default: 'info' }),

  DATABASE_URL: url(),
  REDIS_URL: url(),

  JWT_SECRET: str({ desc: '32-byte hex; openssl rand -hex 32' }),
  JWT_EXPIRY: str({ default: '24h' }),

  ALLOWED_ORIGINS: str({ default: '' }),

  BINANCE_WS_URL: url({ default: 'wss://stream.binance.com:9443/stream' }),
  BINANCE_SYMBOLS: str({ default: 'btcusdt,ethusdt,solusdt' }),

  API_PORT: port({ default: 8000 }),
  API_HEALTH_PORT: port({ default: 9000 }),
  WS_SERVER_PORT: port({ default: 8001 }),
  WS_SERVER_HEALTH_PORT: port({ default: 9001 }),
  PRICE_POLLER_HEALTH_PORT: port({ default: 9002 }),
  BATCH_UPLOADER_HEALTH_PORT: port({ default: 9003 }),
  LIQUIDATION_WORKER_HEALTH_PORT: port({ default: 9004 }),
});

export type Env = typeof env;
