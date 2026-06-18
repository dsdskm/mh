#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# Clear stale API watch processes that often cause EADDRINUSE during hot-restart.
pkill -f "apps/api/node_modules/.bin/../@nestjs/cli/bin/nest.js start --watch" || true

"$SCRIPT_DIR/dev-kill-port.sh" 9000

# API 런타임은 @repo/shared-types 의 컴파일된 dist 를 require 하므로 먼저 빌드한다.
pnpm --filter @repo/shared-types build

exec pnpm --filter api dev
