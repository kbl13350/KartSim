#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PORT=${1:-8772}
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SCRIPT_DIR/site"
