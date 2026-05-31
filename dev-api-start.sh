#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# Clear stale API watch processes that often cause EADDRINUSE during hot-restart.
pkill -f "apps/api/node_modules/.bin/../@nestjs/cli/bin/nest.js start --watch" || true

"$SCRIPT_DIR/dev-kill-port.sh" 3002

exec pnpm --filter api dev
