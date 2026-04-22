#!/usr/bin/env bash
# Stop every process started by `pnpm dev:all`.
# Usage:
#   pnpm stop:all            — kills dev processes, leaves docker running
#   pnpm stop:all --docker   — also stops exness-pg + exness-redis
set -u
# Note: no `set -e` or `-o pipefail` — empty pgrep/lsof/grep results are
# expected success, not failure, and would otherwise bail out mid-script.

echo "▶︎ killing node dev servers (apps/*, next dev, tsx watch, turbo)..."
PATTERNS=(
  "apps/(price-poller|batch-uploader|api|ws-server|liquidation-worker|web)/"
  "next dev"
  "tsx watch"
  "turbo run dev"
  "next-server"
)

self=$$
all_pids=""
for p in "${PATTERNS[@]}"; do
  found=$(pgrep -f "$p" 2>/dev/null || true)
  [ -n "$found" ] && all_pids="$all_pids $found"
done

if [ -n "$all_pids" ]; then
  uniq_pids=$(echo "$all_pids" | tr ' ' '\n' | sort -u | grep -v "^$self$" | grep -v '^$' || true)
  if [ -n "$uniq_pids" ]; then
    echo "  killing PIDs: $(echo "$uniq_pids" | tr '\n' ' ')"
    # shellcheck disable=SC2086
    kill -9 $uniq_pids 2>/dev/null || true
  fi
fi

# Also kill anything still holding our known ports (catches stragglers)
for port in 8000 8001 9001 9002 9003 9004 9005 3001; do
  port_pids=$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null || true)
  for pid in $port_pids; do
    if [ -n "$pid" ] && [ "$pid" != "$self" ]; then
      echo "  killing PID $pid on :$port"
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
done

# Give processes a moment to actually exit before verifying
sleep 1

echo "▶︎ verifying..."
remaining=""
for p in "${PATTERNS[@]}"; do
  found=$(pgrep -f "$p" 2>/dev/null | grep -v "^$self$" || true)
  [ -n "$found" ] && remaining="$remaining $p=$found"
done
if [ -n "$remaining" ]; then
  echo "  ⚠ still running:$remaining"
else
  echo "  ✓ all dev processes stopped"
fi

if [ "${1:-}" = "--docker" ]; then
  echo "▶︎ stopping docker containers..."
  for c in exness-pg exness-redis; do
    if docker ps --filter "name=^${c}$" --format '{{.Names}}' 2>/dev/null | grep -q "^${c}$"; then
      echo "  stopping $c"
      docker stop "$c" > /dev/null
    else
      echo "  $c not running"
    fi
  done
fi

exit 0
