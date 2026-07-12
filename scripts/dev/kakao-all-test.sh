#!/usr/bin/env sh
set -eu

BASE_URL=${BASE_URL:-http://localhost:9000}
ADMIN_USER_ID=${ADMIN_USER_ID:-master}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-1234}
RECEIVER=${1:-01054055939}

escape_json() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

if ! printf '%s' "$RECEIVER" | tr -cd '0-9' | grep -Eq '^[0-9]{8,20}$'; then
  echo "[kakao-all-test] receiver must be 8~20 digits" >&2
  exit 1
fi

# 1) 로그인
login_response=$(curl -sS -X POST "$BASE_URL/api/backoffice/login" \
  -H "Content-Type: application/json" \
  --data-raw "{\"userId\":\"$ADMIN_USER_ID\",\"password\":\"$ADMIN_PASSWORD\"}")

ACCESS_TOKEN=$(printf '%s' "$login_response" | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')
if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "$login_response" ]; then
  echo "[kakao-all-test] login failed" >&2
  printf '%s\n' "$login_response" >&2
  exit 1
fi

escaped_receiver=$(escape_json "$(printf '%s' "$RECEIVER" | tr -cd '0-9')")

payload=$(cat <<EOF
{
  "receiver": "$escaped_receiver"
}
EOF
)

# 2) 전체 케이스 테스트
curl -sS -i -X POST "$BASE_URL/api/backoffice/messages/tests/kakao-all" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data-raw "$payload"
