#!/usr/bin/env bash
# Usage: ./scripts/tail-logs.sh <service-name>
# e.g.: ./scripts/tail-logs.sh price-poller
#
# Runs the named service in dev mode. `pnpm dev` already streams pino-pretty
# coloured output; this wrapper keeps the command ergonomic at the repo root.
set -euo pipefail
SERVICE="${1:-api}"
echo "Tailing logs for $SERVICE (pino-pretty via pnpm dev)"
pnpm --silent --filter "@exness/${SERVICE}" dev
