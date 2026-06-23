#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

direction=${1:-}
shift || true

usage() {
  echo "사용법: sh ./scripts/db/server-to-local.sh" >&2
  echo "   또는: sh ./scripts/db/local-to-server.sh -- --confirm-server-write" >&2
}

fail() {
  echo "[database-sync] 실패: $1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 명령어가 필요합니다."
}

read_env_value() {
  env_file=$1
  env_key=$2

  [ -f "$env_file" ] || return 0

  awk -v key="$env_key" '
    /^[[:space:]]*#/ || !/=/{ next }
    {
      line = $0
      key_part = substr(line, 1, index(line, "=") - 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", key_part)
      if (key_part != key) {
        next
      }

      value = substr(line, index(line, "=") + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      if (value ~ /^".*"$/ || value ~ /^'\''.*'\''$/) {
        value = substr(value, 2, length(value) - 2)
      }
      print value
      exit
    }
  ' "$env_file"
}

trim_trailing_slashes() {
  printf '%s' "$1" | sed 's:/*$::'
}

auth_mode() {
  endpoint_name=$1
  endpoint_secret=$2
  endpoint_token=$3

  if [ -n "$endpoint_secret" ]; then
    printf 'secret'
    return 0
  fi

  if [ -n "$endpoint_token" ]; then
    printf 'token'
    return 0
  fi

  fail "$endpoint_name 인증값이 없습니다. DATABASE_SYNC_SECRET 또는 ADMIN_TOKEN을 설정해주세요."
}

request_get() {
  endpoint_name=$1
  endpoint_url=$2
  endpoint_secret=$3
  endpoint_token=$4
  endpoint_path=$5
  output_file=$6
  mode=$(auth_mode "$endpoint_name" "$endpoint_secret" "$endpoint_token")

  if [ "$mode" = "secret" ]; then
    curl -fsS "$endpoint_url$endpoint_path" \
      -H 'Accept: application/json' \
      -H "x-database-sync-secret: $endpoint_secret" \
      -o "$output_file"
    return 0
  fi

  curl -fsS "$endpoint_url$endpoint_path" \
    -H 'Accept: application/json' \
    -H "Authorization: Bearer $endpoint_token" \
    -o "$output_file"
}

request_post_file() {
  endpoint_name=$1
  endpoint_url=$2
  endpoint_secret=$3
  endpoint_token=$4
  endpoint_path=$5
  input_file=$6
  output_file=$7
  mode=$(auth_mode "$endpoint_name" "$endpoint_secret" "$endpoint_token")

  if [ "$mode" = "secret" ]; then
    curl -fsS "$endpoint_url$endpoint_path" \
      -X POST \
      -H 'Accept: application/json' \
      -H 'Content-Type: application/json' \
      -H "x-database-sync-secret: $endpoint_secret" \
      --data-binary "@$input_file" \
      -o "$output_file"
    return 0
  fi

  curl -fsS "$endpoint_url$endpoint_path" \
    -X POST \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $endpoint_token" \
    --data-binary "@$input_file" \
    -o "$output_file"
}

require_command curl
require_command cmp
require_command mktemp

[ "$direction" = "pull" ] || [ "$direction" = "push" ] || {
  usage
  fail "첫 번째 인자는 pull 또는 push 여야 합니다."
}

confirm_server_write=false
for arg in "$@"; do
  if [ "$arg" = "--confirm-server-write" ]; then
    confirm_server_write=true
  fi
done

if [ "$direction" = "push" ] && [ "$confirm_server_write" != "true" ]; then
  fail "서버 DB 쓰기를 확인하려면 --confirm-server-write 플래그가 필요합니다."
fi

local_env_file="$PROJECT_ROOT/apps/api/.env"
server_env_file="$PROJECT_ROOT/apps/api/.env.prd"

local_api_url=$(trim_trailing_slashes "${LOCAL_API_BASE_URL:-$(read_env_value "$local_env_file" NEXT_PUBLIC_API_BASE_URL || true)}")
server_api_url=$(trim_trailing_slashes "${SERVER_API_BASE_URL:-$(read_env_value "$server_env_file" NEXT_PUBLIC_API_BASE_URL || true)}")

[ -n "$local_api_url" ] || local_api_url="http://localhost:9000"
[ -n "$server_api_url" ] || fail "SERVER_API_BASE_URL 또는 apps/api/.env.prd의 NEXT_PUBLIC_API_BASE_URL이 필요합니다."

local_secret=${LOCAL_DATABASE_SYNC_SECRET:-dev-database-sync-secret-change-me}
server_secret=${SERVER_DATABASE_SYNC_SECRET:-}
local_token=${LOCAL_ADMIN_TOKEN:-}
server_token=${SERVER_ADMIN_TOKEN:-}

if [ "$direction" = "pull" ]; then
  source_name='서버'
  source_url=$server_api_url
  source_secret=$server_secret
  source_token=$server_token
  target_name='로컬'
  target_url=$local_api_url
  target_secret=$local_secret
  target_token=$local_token
else
  source_name='로컬'
  source_url=$local_api_url
  source_secret=$local_secret
  source_token=$local_token
  target_name='서버'
  target_url=$server_api_url
  target_secret=$server_secret
  target_token=$server_token
fi

[ "$source_url" != "$target_url" ] || fail "원본과 대상 API 주소가 같습니다: $source_url"

manifest_source=$(mktemp)
manifest_target=$(mktemp)
export_file=$(mktemp)
import_file=$(mktemp)
cleanup() {
  rm -f "$manifest_source" "$manifest_target" "$export_file" "$import_file"
}
trap cleanup EXIT INT TERM HUP

echo "[database-sync] $source_name($source_url) -> $target_name($target_url)"

request_get "$source_name" "$source_url" "$source_secret" "$source_token" \
  '/api/backoffice/database-sync/manifest' "$manifest_source"
request_get "$target_name" "$target_url" "$target_secret" "$target_token" \
  '/api/backoffice/database-sync/manifest' "$manifest_target"

cmp -s "$manifest_source" "$manifest_target" || \
  fail '원본과 대상의 데이터베이스 동기화 API 버전/테이블 구성이 다릅니다.'

request_get "$source_name" "$source_url" "$source_secret" "$source_token" \
  '/api/backoffice/database-sync/export' "$export_file"

request_post_file "$target_name" "$target_url" "$target_secret" "$target_token" \
  '/api/backoffice/database-sync/import' "$export_file" "$import_file"

echo '[database-sync] 완료'
cat "$import_file"