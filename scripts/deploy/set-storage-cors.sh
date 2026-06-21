#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <bucket-name> [origin1 origin2 ...]" >&2
  echo "Example: $0 corn-fbaae.firebasestorage.app http://localhost:9002 https://admin.example.com" >&2
  exit 1
fi

BUCKET_NAME="$1"
shift || true

if [ "$#" -eq 0 ]; then
  set -- "http://localhost:9002" "http://localhost:3000"
fi

TMP_CORS_FILE="$(mktemp /tmp/gcs-cors.XXXXXX.json)"

cleanup() {
  rm -f "$TMP_CORS_FILE"
}
trap cleanup EXIT

ORIGIN_COUNT="$#"
ORIGIN_INDEX=1

{
  echo "["
  echo "  {"
  echo "    \"origin\": ["

  for ORIGIN in "$@"; do
    if [ "$ORIGIN_INDEX" -lt "$ORIGIN_COUNT" ]; then
      COMMA=","
    else
      COMMA=""
    fi

    printf '      "%s"%s\n' "$ORIGIN" "$COMMA"
    ORIGIN_INDEX=$((ORIGIN_INDEX + 1))
  done

  echo "    ],"
  echo "    \"method\": [\"GET\", \"HEAD\", \"PUT\", \"POST\", \"OPTIONS\"],"
  echo "    \"responseHeader\": [\"Content-Type\", \"x-goog-resumable\", \"x-goog-meta-*\"],"
  echo "    \"maxAgeSeconds\": 3600"
  echo "  }"
  echo "]"
} > "$TMP_CORS_FILE"

echo "Applying CORS to gs://$BUCKET_NAME"
gcloud storage buckets update "gs://$BUCKET_NAME" --cors-file="$TMP_CORS_FILE"

echo "Current CORS config for gs://$BUCKET_NAME"
gcloud storage buckets describe "gs://$BUCKET_NAME" --format="value(cors_config)"
