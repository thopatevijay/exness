# Exness Clone

> A CFD (Contract for Difference) trading platform inspired by Exness.
> Live Binance prices, margin + leverage trading, automatic
> stop-loss / take-profit / liquidation, polished real-time UI,
> email notifications, and Railway-ready deployment.

**Live:** https://exness-clone.up.railway.app/webtrading

A production-leaning trading system: 7 services, refresh-token auth,
idempotent mutations, showroom-mode, in-chart position markers, history
analytics, and email notifications via Resend.

## What it does

- Sign up with a $5,000 simulated USD balance (deposits and demo-reset from a settings popover)
- Stream live BTC / ETH / SOL prices from the Binance public WS feed (with 365-day historical backfill on startup)
- Open leveraged long or short positions (1× / 5× / 10× / 20× / 100×) with optional stop-loss and take-profit
- **Edit SL/TP** on open positions; **idempotency keys** on every mutation prevent double-fills
- A background **liquidation engine** auto-closes positions on SL, TP, or margin-out — every tick, in milliseconds
- **Showroom mode** — `/webtrading` is publicly readable; only mutations require auth
- **Email notifications** — order opened / closed / modified, deposits, reset events (via Resend)
- Watch the candlestick chart update in real time — volume bars, in-chart position markers, cursor-locked OHLC, blue/red candles
- Filter and export trade history (CSV) with a P&L histogram
- Per-user authenticated WebSocket pushes price + order updates to the browser

## Notable architecture decisions

- **Event bus over polling.** All cross-service signaling is Redis Streams. `trade_executed` is the single source of truth for trade lifecycle — `cg:ws` (ws-server), `cg:liq-index` (liquidation-worker), `cg:notifier` (notifier) consume independently with at-least-once delivery via PEL replay. Adding a feature ("send SMS on close", "hedge on a DEX") = new consumer, not edits across services.
- **Money is bigint, never float.** Every monetary value is `{value: bigint, decimals: number}` — `usd_balance` in cents (decimals=2), BTC price scaled to 4 decimals, SOL to 6. An ESLint rule blocks raw `Number()` / `parseInt()` / `parseFloat()` in business code; explicit `// eslint-disable-next-line` is required at API boundaries with a reason.
- **Atomic close.** A single Postgres transaction does `DELETE FROM orders … RETURNING` + `UPDATE balances` + `INSERT trade_history`. The `RETURNING` row enforces exactly-once close even when liquidation-worker and a manual close race for the same order — only one wins, the other returns "lost race."
- **In-memory order index.** liquidation-worker holds a hash map of all open orders in process memory. Per-tick evaluation is O(orders-on-the-moving-asset), not O(all-orders). A 30-second reconciler resyncs from Postgres so the index can never drift forever.
- **TimescaleDB continuous aggregates.** Six candle timeframes (1m / 5m / 15m / 1h / 1d / 1w) are CAGGs over a single `ticks` hypertable — Postgres rebuilds them on insert, so `/candles` queries hit a materialized view instead of aggregating millions of ticks at request time.
- **Backend-for-Frontend (BFF) auth.** Browser only sees the Next.js origin. The api lives on a private network. Cookies are httpOnly + `__Host-` / `__Secure-` prefixed in prod. JWT never reaches client JS — even XSS can't read it.
- **Showroom mode.** Landing + chart are publicly readable. Guests get a synthetic `guest:<uuid>` userId, can subscribe to price feeds via WS, but every mutation requires auth. Demos work without forcing signup.

## Architecture at a glance

Seven services in a pnpm + Turborepo monorepo, plus Postgres + TimescaleDB and Redis:

```
Binance WS  →  price-poller  →  Redis (Pub/Sub + Streams + KV)
                                  ├──→  ws-server          →  Browser (live prices + order updates)
                                  ├──→  liquidation-worker →  Postgres (atomic close)
                                  ├──→  batch-uploader     →  TimescaleDB (ticks + CAGGs)
                                  ├──→  notifier           →  Resend (email events)
                                  └──→  api (REST + auth)  →  Postgres
                                                              ↑
                                                      Next.js 16 web app
                                                      (showroom + authed)
```

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (Turbopack) · React 19 · Tailwind 4 · lightweight-charts 5 · recharts |
| API | Express 5 · zod · helmet · express-rate-limit · cookie-parser · pino-http |
| Realtime | Node `ws` · per-user subscription registry · single-use Redis ticket auth |
| Persistence | Postgres 17 + TimescaleDB 2.26 · Prisma 6 · raw SQL on hot paths |
| Bus | Redis 7 · ioredis · Streams + consumer groups · pub/sub for prices |
| Email | Resend · typed template functions · dry-run fallback |
| Tooling | pnpm 10 workspace · Turbo 2 · TypeScript 6 · ESLint 10 · Prettier 3 |
| Deploy | Railway · Railpack · `railway.toml` per service · GitHub-driven |

## Failure modes

| Failure | Behavior |
|---|---|
| Binance WS disconnects | price-poller auto-reconnects with exponential backoff; api falls back to `last:*` Redis snapshot; `/trade` rejects with `PRICE_UNAVAILABLE` if too stale |
| ws-server restarts | Browser reconnects, mints a fresh ticket, consumer group resumes from PEL; missed messages redeliver |
| liquidation-worker restarts | In-memory index rebuilt from Postgres; `cg:liq-index` redelivers unacked stream entries |
| Postgres unreachable | api returns 503 on protected reads; workers retry with backoff; `redis denylist` and `latest:*` keys keep auth + price reads alive |
| Redis hiccup | Auth denylist check fails-open with a warning log; rate-limit middleware degrades gracefully; idempotency lock skips, falls through |
| HIBP API timeout | Signup proceeds (fail-open by design — defense layer, not hard gate) |
| Resend API down | Notifier logs the failure, ack's the stream entry, moves on — trade flow never blocks on email |

## Quick start

### Prerequisites

- Node.js 24+ (LTS) or 25
- pnpm 10+
- Postgres 16+ with TimescaleDB extension (default port `5434`)
- Redis 7+

### Setup

```bash
# 1. Clone + install
git clone https://github.com/thopatevijay/exness.git && cd exness
pnpm install

# 2. Environment
cp .env.example .env
# edit .env — DATABASE_URL, REDIS_URL, JWT_SECRET (openssl rand -hex 32),
# ALLOWED_ORIGINS, optional RESEND_API_KEY (defaults to dry-run)

# 3. Database
pnpm db:bootstrap     # creates tables, hypertable, CAGGs, seeds assets

# 4. Run all services
pnpm dev:all          # starts 7 services in tmux (or `pnpm dev` for turbo parallel)
```

Open `http://localhost:3001` — landing page is showroom-mode (no signup required to view).
Sign up to trade.

### Useful scripts

```bash
pnpm gap:fill         # one-shot Binance klines backfill (handy if local DB is fresh)
pnpm log:tail <svc>   # pretty-print logs for a service
pnpm stop:all         # tear down dev:all
```

## Security & hardening

- **Auth flow:** access token 15m (in `__Host-token` cookie in prod) + refresh token 7d. `jti` denylist on logout. WS auth via single-use Redis ticket from `POST /auth/ws-ticket`.
- **CORS:** strict allowlist from `ALLOWED_ORIGINS` env (no wildcards). 
- **CSP:** helmet on api + Next config on web; dev allows `unsafe-eval`, prod blocks.
- **Passwords:** bcrypt (cost 12) + HIBP `pwnedpasswords` API check on signup; warn-on-signin if breached.
- **Rate limits:** signup 5/min/IP, trade 30/min/user, close 60/min/user, deposit 1/hour/user (all backed by Redis).
- **Body limits:** auth routes 8 KB; trade 4 KB; default 64 KB.
- **Idempotency:** every POST mutation requires an `Idempotency-Key` header; cached for 1h, locked for 5s.
- **Admin gating:** `requireAdmin` middleware backed by `users.is_admin` column protects `/admin/*`.
- **Trust-boundary checks:** trade ownership scoped on `DELETE` in liq-worker; SL/TP rejected if already in-the-money at open.

## Deployment

Each service has a `railway.toml` (`apps/*/railway.toml`) wired up for Railway. Build is Turbo-orchestrated so dependent packages compile in order. Health checks point to each service's `/health` port.

Set in Railway (or your platform of choice):
- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`
- `RESEND_API_KEY` (or leave unset; defaults to dry-run)
- `NODE_ENV=production` (turns on `__Host-` cookie prefix, locks CSP)

## Project layout

```
apps/
  price-poller/           Binance WS → Redis (prices Pub/Sub, trades Stream, latest KV)
  ws-server/              JWT-auth WebSocket; per-user fanout; rAF-coalesced price batching
  api/                    REST + refresh-token auth + idempotency + admin gating
  batch-uploader/         Streams consumer → bulk INSERT ticks; auto gap-fill from Binance klines
  liquidation-worker/     Tick-driven SL/TP/liq engine; consumes trade_executed via cg:liq-index
  notifier/               Resend-backed email service; consumes trade_executed + user_events
  web/                    Next.js 16 dashboard (`/webtrading` + `/webtrading/history`, `/webtrading/health`)
packages/
  money/                  bigint Price/Amount types + all math
  shared/                 zod schemas, event types, asset decimals
  db/                     Prisma schema + migrations + generate-on-build
  logger/                 pino config
  config/                 envalid env parsing
  bus/                    Redis adapter (pub/sub + streams interface)
  eslint-config/          shared lint rules (no-floats rule)
  typescript-config/      shared tsconfig bases
scripts/
  bootstrap.sql           DB schema, hypertables, CAGGs
  seed-assets.sql         BTC/ETH/SOL catalog
  reset.sql               full teardown
  dev-all.sh              tmux orchestration for local dev
docs/                     specs, ADRs, diagrams, demo script, FAQ (private)
```
## License

MIT — see [LICENSE](./LICENSE).
