# Exness Clone — V0

> A CFD (Contract for Difference) trading platform inspired by Exness.
> Live Binance prices, margin + leverage trading, automatic
> stop-loss / take-profit / liquidation, polished real-time UI.

This is the V0 build: the full user-facing trading experience plus the
backend infrastructure that makes it real-time, durable, and observable.

## What it does

- Sign up with a $5,000 simulated USD balance
- Stream live BTC / ETH / SOL prices from the Binance public WS feed
- Open leveraged long or short positions (1× / 5× / 10× / 20× / 100×) with optional stop-loss and take-profit
- A background **liquidation engine** auto-closes positions on SL, TP, or margin-out — every tick, in milliseconds
- Watch the candlestick chart update in real time, with all 1m / 5m / 15m / 1h / 1d / 1w timeframes
- Per-user authenticated WebSocket pushes price + order updates to the browser

## Architecture at a glance

Six services in a pnpm + Turborepo monorepo, plus Postgres + TimescaleDB and Redis:

```
Binance WS  →  price-poller  →  Redis (Pub/Sub + Streams)
                                 ├──→  ws-server          →  Browser
                                 ├──→  liquidation-worker →  Postgres
                                 ├──→  batch-uploader     →  TimescaleDB
                                 └──→  api (REST + auth)  →  Postgres
                                                              ↑
                                                      Next.js web app
```

## Stand-out features

- **Strict integer-only money** — `bigint + decimals` everywhere, zero floats in business logic
- **Working liquidation worker** — tick-driven, three-heap index, exactly-once close via `DELETE … RETURNING`
- **TimescaleDB continuous aggregates** — six candle timeframes auto-built from a single `ticks` hypertable
- **Redis Streams with consumer groups + XACK** — durable, replay-safe, scale-out ready
- **JWT-authenticated WebSocket** — per-user subscription model, no anonymous sockets
- **Observability** — pino structured logs with request IDs, `prom-client` `/metrics` endpoint, per-service `/health`

## Quick start

### Prerequisites

- Node.js 24+ (LTS) or 25
- pnpm 10+
- Postgres 16+ with TimescaleDB extension
- Redis 7+

### Setup

```bash
# 1. Clone + install
git clone <repo-url> exness && cd exness
pnpm install

# 2. Environment
cp .env.example .env
# edit .env — DATABASE_URL, REDIS_URL, JWT_SECRET (openssl rand -hex 32)

# 3. Database
pnpm db:bootstrap     # creates tables, hypertable, CAGGs, seeds assets

# 4. Run all services
pnpm dev              # starts all 6 services in parallel via turbo
```

Open http://localhost:3000 — sign up with any email + password.

### Demo a liquidation in 60 seconds

```bash
pnpm tsx scripts/demo.ts
```

Creates a demo user + a 100× leveraged BTC long with a tight SL — a normal market move closes it, broadcast to WS, visible in the UI as a red toast within seconds.

## Project layout

```
apps/
  price-poller/           Binance WS → Redis fan-out
  ws-server/              Per-user JWT-auth WebSocket
  api/                    REST + auth + order lifecycle
  batch-uploader/         Redis Streams → Timescale
  liquidation-worker/     Tick-driven SL/TP/liq engine
  web/                    Next.js 16 dashboard
packages/
  money/                  bigint Price/Amount types + all math
  shared/                 zod schemas, event types
  db/                     Prisma schema + migrations
  logger/                 pino config
  config/                 envalid env parsing
  bus/                    Redis adapter
  eslint-config/          shared lint rules
  typescript-config/      shared tsconfig bases
scripts/
  bootstrap.sql           DB schema, hypertables, CAGGs, asset seed
  demo.ts                 interview demo seed
docs/                     specs, ADRs, diagrams, demo script, FAQ
```

## License

MIT — see [LICENSE](./LICENSE).
