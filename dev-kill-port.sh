#!/usr/bin/env sh
set -eu

if [ "$#" -gt 0 ]; then
  PORTS="$*"
else
  PORTS="3000 3001 3002"
fi

FOUND=0

for PORT in $PORTS; do
  PIDS=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN || true)

  if [ -z "$PIDS" ]; then
    echo "No process is listening on port $PORT"
    continue
  fi

  FOUND=1
  echo "Killing process(es) on port $PORT: $PIDS"
  # shellcheck disable=SC2086
  kill $PIDS
done

if [ "$FOUND" -eq 0 ]; then
  exit 0
fi

echo "Done"
