#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)

cd "$ROOT_DIR"

echo "[cache] clearing workspace caches (.next/.turbo/.cache/dist)..."
find . -path './node_modules' -prune -o -type d -name '.next' -prune -exec rm -rf {} +
find . -path './node_modules' -prune -o -type d -name '.turbo' -prune -exec rm -rf {} +
find . -path './node_modules' -prune -o -type d -name '.cache' -prune -exec rm -rf {} +
find . -path './node_modules' -prune -o -type d -name 'dist' -prune -exec rm -rf {} +

echo "[cache] clearing TypeScript incremental cache (*.tsbuildinfo)..."
find . -path './node_modules' -prune -o -type f -name '*.tsbuildinfo' -delete

echo "[cache] clearing pnpm store..."
STORE_PATH=$(pnpm store path)
if [ -d "$STORE_PATH" ]; then
  # Use find instead of shell globs to avoid interactive delete prompts.
  find "$STORE_PATH" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
fi
pnpm store prune >/dev/null 2>&1 || true

echo "[cache] verify remaining cache-like dirs (excluding node_modules)..."
REMAINING=$(find . -path './node_modules' -prune -o -type d \( -name '.next' -o -name '.turbo' -o -name '.cache' -o -name 'dist' \) -print | sed 's#^./##' || true)

if [ -n "$REMAINING" ]; then
  echo "$REMAINING"
  echo "[cache] done with warnings: some directories remain."
  exit 1
fi

echo "[cache] done. all requested caches are cleared."
