#!/usr/bin/env sh
set -eu

BASE_URL=${BASE_URL:-http://localhost:9000}
ADMIN_USER_ID=${ADMIN_USER_ID:-master}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-1234}
RECEIVER=${1:-01054055939}
CONTENT=${2:-테스트입니다}
RESERVE_DT=${RESERVE_DT:-}
ADS_YN=${ADS_YN:-false}
REQUEST_NUM=${REQUEST_NUM:-}

escape_json() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

if [ -n "$RESERVE_DT" ] && ! printf '%s' "$RESERVE_DT" | grep -Eq '^[0-9]{14}$'; then
  echo "[sms-test] RESERVE_DT must be yyyyMMddHHmmss" >&2
  exit 1
fi

if [ -n "$REQUEST_NUM" ] && ! printf '%s' "$REQUEST_NUM" | grep -Eq '^[A-Za-z0-9_-]{1,36}$'; then
  echo "[sms-test] REQUEST_NUM must match ^[A-Za-z0-9_-]{1,36}$" >&2
  exit 1
fi

# 1) 로그인 → 토큰 발급
echo "[sms-test] POST $BASE_URL/api/backoffice/login (userId=$ADMIN_USER_ID)"
login_response=$(curl -sS -X POST "$BASE_URL/api/backoffice/login" \
  -H "Content-Type: application/json" \
  --data-raw "{\"userId\":\"$ADMIN_USER_ID\",\"password\":\"$ADMIN_PASSWORD\"}")

ACCESS_TOKEN=$(printf '%s' "$login_response" | sed 's/.*"accessToken":"\([^"]*\)".*/\1/')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "$login_response" ]; then
  echo "[sms-test] 로그인 실패 또는 토큰 파싱 실패:" >&2
  printf '%s\n' "$login_response" >&2
  exit 1
fi

echo "[sms-test] 로그인 성공 (token=${ACCESS_TOKEN%${ACCESS_TOKEN#??????????}}...)"

# 2) 문자 발송
escaped_receiver=$(escape_json "$RECEIVER")
escaped_content=$(escape_json "$CONTENT")
escaped_reserve_dt=$(escape_json "$RESERVE_DT")
escaped_request_num=$(escape_json "$REQUEST_NUM")

payload=$(cat <<EOF
{"receiver":"$escaped_receiver","content":"$escaped_content","reserveDT":"$escaped_reserve_dt","adsYN":$ADS_YN,"requestNum":"$escaped_request_num"}
EOF
)

echo "[sms-test] POST $BASE_URL/api/backoffice/messages/sms"
echo "[sms-test] receiver=$RECEIVER"

curl -sS -i -X POST "$BASE_URL/api/backoffice/messages/sms" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data-raw "$payload"
