#!/usr/bin/env bash
set -euo pipefail

root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if curl -fsS http://127.0.0.1:8787/multiplayer/healthz >/dev/null 2>&1; then
  echo "A server is already using port 8787; stop it before using this launcher." >&2
  exit 1
fi
if [[ ! -d "$root/rewrite/node_modules" ]]; then
  (cd "$root/rewrite" && npm ci)
fi

# Build once with the pinned dependencies and then run the Java process itself,
# so Ctrl-C can reliably stop both local services.
(cd "$root/server" && ./mvnw -q -DskipTests package)

KART_DATA_DIR="${KART_DATA_DIR:-$root/server/data}" \
  java -jar "$root/server/target/kartsim-server-1.0.0.jar" &
server_pid=$!
client_pid=

stop_services() {
  if [[ -n "$client_pid" ]]; then kill "$client_pid" 2>/dev/null || true; fi
  kill "$server_pid" 2>/dev/null || true
  if [[ -n "$client_pid" ]]; then wait "$client_pid" 2>/dev/null || true; fi
  wait "$server_pid" 2>/dev/null || true
}
trap stop_services EXIT INT TERM

for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:8787/multiplayer/healthz >/dev/null 2>&1; then break; fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "Java service exited during startup" >&2
    exit 1
  fi
  sleep 1
done
if ! curl -fsS http://127.0.0.1:8787/multiplayer/healthz >/dev/null; then
  echo "Java service did not become ready on port 8787" >&2
  exit 1
fi

echo "Java service: http://127.0.0.1:8787"
echo "Starting game frontend (the address will be printed by Vite)..."
(cd "$root/rewrite" && npm run dev) &
client_pid=$!
wait "$client_pid"
