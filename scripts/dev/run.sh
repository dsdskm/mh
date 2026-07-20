#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

cd "$APP_ROOT"

if [ "$#" -gt 0 ]; then
  APP_NAME="$1"

  if [ "$APP_NAME" = "web" ]; then
    exec pnpm --filter web exec next dev --webpack --port 9001
  fi

  exec pnpm --filter "$APP_NAME" dev
fi

exec pnpm dev
