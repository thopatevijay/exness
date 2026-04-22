#!/usr/bin/env bash
# Start the entire stack: docker containers + all services + web.
# Usage: pnpm dev:all
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▶︎ ensuring docker containers are up..."
for c in exness-pg exness-redis; do
  if ! docker ps --filter "name=^${c}$" --format '{{.Names}}' | grep -q "^${c}$"; then
    if docker ps -a --filter "name=^${c}$" --format '{{.Names}}' | grep -q "^${c}$"; then
      echo "  starting $c"
      docker start "$c" > /dev/null
    else
      echo "  ERROR: container '$c' does not exist. Re-run Stage 02 setup."
      exit 1
    fi
  else
    echo "  $c already running"
  fi
done

echo "▶︎ waiting for postgres to accept connections..."
for i in {1..30}; do
  if docker exec exness-pg pg_isready -U postgres -q 2>/dev/null; then
    break
  fi
  sleep 1
done

if [ ! -f .env ]; then
  echo "ERROR: .env not found at repo root. Copy .env.example to .env first."
  exit 1
fi

echo "▶︎ loading .env and starting all services via turbo..."
set -a
# shellcheck disable=SC1091
source .env
set +a

exec pnpm turbo run dev --parallel --env-mode=loose
