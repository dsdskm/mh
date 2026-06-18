#!/usr/bin/env sh
set -eu

if [ "$#" -gt 0 ]; then
  APP_NAME="$1"
  exec pnpm --filter "$APP_NAME" dev
fi

exec pnpm dev
