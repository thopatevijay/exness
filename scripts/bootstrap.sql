-- Extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================================================
-- USERS
-- ===========================================================================
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- ASSETS
-- ===========================================================================
-- Per spec: each asset has its own decimals. Prices for this asset are
-- stored, transported, and serialized at exactly `decimals`.
-- Example: SOL decimals=6 → $211.11 stored as bigint 211110000.
CREATE TABLE IF NOT EXISTS assets (
  symbol           text PRIMARY KEY,
  name             text NOT NULL,
  binance_symbol   text NOT NULL,
  decimals         smallint NOT NULL,
  image_url        text NOT NULL,
  is_active        boolean NOT NULL DEFAULT true
);

-- ===========================================================================
-- BALANCES
-- ===========================================================================
CREATE TABLE IF NOT EXISTS balances (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  usd_balance bigint NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ===========================================================================
-- ORDERS (open positions)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id),
  asset              text NOT NULL REFERENCES assets(symbol),
  side               text NOT NULL CHECK (side IN ('buy', 'sell')),
  margin             bigint NOT NULL CHECK (margin > 0),
  leverage           smallint NOT NULL CHECK (leverage IN (1, 5, 10, 20, 100)),
  open_price         bigint NOT NULL CHECK (open_price > 0),
  stop_loss          bigint,
  take_profit        bigint,
  liquidation_price  bigint NOT NULL CHECK (liquidation_price > 0),
  opened_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_idx  ON orders (user_id);
CREATE INDEX IF NOT EXISTS orders_asset_idx ON orders (asset);

-- ===========================================================================
-- TRADE_HISTORY (closed positions, append-only)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS trade_history (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id),
  asset         text NOT NULL REFERENCES assets(symbol),
  side          text NOT NULL CHECK (side IN ('buy', 'sell')),
  margin        bigint NOT NULL,
  leverage      smallint NOT NULL,
  open_price    bigint NOT NULL,
  close_price   bigint NOT NULL,
  pnl           bigint NOT NULL,
  close_reason  text NOT NULL CHECK (close_reason IN ('manual', 'sl', 'tp', 'liquidation')),
  opened_at     timestamptz NOT NULL,
  closed_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trade_history_user_idx ON trade_history (user_id, closed_at DESC);

-- ===========================================================================
-- TICKS (Timescale hypertable)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS ticks (
  time   timestamptz NOT NULL,
  asset  text NOT NULL,
  price  bigint NOT NULL CHECK (price > 0),
  qty    bigint NOT NULL DEFAULT 0     -- trade quantity at 8 decimals (base asset units)
);
SELECT create_hypertable('ticks', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS ticks_asset_time_idx ON ticks (asset, time DESC);

-- Idempotency: avoid double-insert on consumer restart
CREATE UNIQUE INDEX IF NOT EXISTS ticks_unique_idx ON ticks (time, asset);

-- Retention: drop raw ticks older than 48h (CAGGs hold OHLC forever)
SELECT add_retention_policy('ticks', INTERVAL '48 hours', if_not_exists => TRUE);

-- ===========================================================================
-- CONTINUOUS AGGREGATES (candles per timeframe)
-- ===========================================================================
-- 1 minute
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  asset,
  FIRST(price, time) AS open,
  MAX(price)         AS high,
  MIN(price)         AS low,
  LAST(price, time)  AS close,
  SUM(qty)           AS volume,
  COUNT(*)           AS trade_count
FROM ticks
GROUP BY bucket, asset;
SELECT add_continuous_aggregate_policy('candles_1m',
  start_offset      => INTERVAL '2 hours',
  end_offset        => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute',
  if_not_exists     => TRUE);

-- 5 minute
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_5m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', time) AS bucket,
  asset,
  FIRST(price, time) AS open,
  MAX(price)         AS high,
  MIN(price)         AS low,
  LAST(price, time)  AS close,
  SUM(qty)           AS volume,
  COUNT(*)           AS trade_count
FROM ticks
GROUP BY bucket, asset;
SELECT add_continuous_aggregate_policy('candles_5m',
  start_offset => INTERVAL '6 hours', end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes', if_not_exists => TRUE);

-- 15 minute
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_15m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('15 minutes', time) AS bucket,
  asset,
  FIRST(price, time) AS open,
  MAX(price)         AS high,
  MIN(price)         AS low,
  LAST(price, time)  AS close,
  SUM(qty)           AS volume,
  COUNT(*)           AS trade_count
FROM ticks
GROUP BY bucket, asset;
SELECT add_continuous_aggregate_policy('candles_15m',
  start_offset => INTERVAL '12 hours', end_offset => INTERVAL '15 minutes',
  schedule_interval => INTERVAL '15 minutes', if_not_exists => TRUE);

-- 1 hour
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  asset,
  FIRST(price, time) AS open,
  MAX(price)         AS high,
  MIN(price)         AS low,
  LAST(price, time)  AS close,
  SUM(qty)           AS volume,
  COUNT(*)           AS trade_count
FROM ticks
GROUP BY bucket, asset;
SELECT add_continuous_aggregate_policy('candles_1h',
  start_offset => INTERVAL '2 days', end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour', if_not_exists => TRUE);

-- 1 day
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1d
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS bucket,
  asset,
  FIRST(price, time) AS open,
  MAX(price)         AS high,
  MIN(price)         AS low,
  LAST(price, time)  AS close,
  SUM(qty)           AS volume,
  COUNT(*)           AS trade_count
FROM ticks
GROUP BY bucket, asset;
SELECT add_continuous_aggregate_policy('candles_1d',
  start_offset => INTERVAL '30 days', end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 hour', if_not_exists => TRUE);

-- 1 week
CREATE MATERIALIZED VIEW IF NOT EXISTS candles_1w
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 week', time) AS bucket,
  asset,
  FIRST(price, time) AS open,
  MAX(price)         AS high,
  MIN(price)         AS low,
  LAST(price, time)  AS close,
  SUM(qty)           AS volume,
  COUNT(*)           AS trade_count
FROM ticks
GROUP BY bucket, asset;
SELECT add_continuous_aggregate_policy('candles_1w',
  start_offset => INTERVAL '90 days', end_offset => INTERVAL '1 week',
  schedule_interval => INTERVAL '1 day', if_not_exists => TRUE);
