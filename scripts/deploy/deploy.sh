#!/usr/bin/env sh
set -eu

# Cloud Run 배포 스크립트
#   전체 배포:   ./deploy.sh            (또는 ./deploy.sh all)
#   개별 배포:   ./deploy.sh api | web | admin
#
# 흐름: Cloud Build 로 이미지 빌드/푸시 -> Cloud Run 배포.
# web/admin 의 NEXT_PUBLIC_* 는 빌드 타임 인라인 값이라 빌드 시 주입하고,
# DATABASE_URL/KAKAO_*/NEXTAUTH_* 는 런타임 값이라 Cloud Run env 로 주입한다.
# (Secret Manager 미사용 — 값은 아래 변수에 직접 넣는다. 콘솔에 평문 노출됨.)
# NEXT_PUBLIC_API_BASE_URL 은 api 의 Cloud Run URL 이므로 api 를 먼저 배포한다.
#
# 사전 준비(1회): gcloud 로그인 + 프로젝트 설정 + API 활성화
#   gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
#     artifactregistry.googleapis.com sqladmin.googleapis.com
#   런타임 SA(<PROJECT_NUMBER>-compute@...)에 roles/cloudsql.client 부여

# 어디서 실행하든 레포 루트를 빌드 컨텍스트로 쓰도록 이동한다.
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
cd "$ROOT_DIR"

PROJECT=corn-fbaae
REGION=asia-northeast3
REPO=asia-northeast3-docker.pkg.dev/corn-fbaae/corn-repo
INSTANCE_CONN=corn-fbaae:asia-northeast3:corn-db-instance

# ===== 직접 채워야 하는 값 =====================================
# DB 접속 문자열 (Cloud Run 은 유닉스 소켓으로 접속, 비밀번호의 '#' -> %23)
DATABASE_URL='postgresql://postgres:Kk1328911%23@/postgres?host=/cloudsql/corn-fbaae:asia-northeast3:corn-db-instance'
# web next-auth JWT 서명 키 (한 번 정하면 그대로 유지해야 기존 세션이 안 깨짐)
NEXTAUTH_SECRET="a582a79c63e3ee8bf22a7d95a0bffcb26e3f70f3a0ed2a1a5a0774da2a32f1d6"
# admin Firebase 웹 SDK 설정 (콘솔 > 프로젝트 설정 > 일반 > 내 앱)
FB_API_KEY=""
FB_AUTH_DOMAIN=""
FB_PROJECT_ID=""
FB_STORAGE_BUCKET=""
FB_MESSAGING_SENDER_ID=""
FB_APP_ID=""
# web 카카오 로그인 (안 쓰면 비워둬도 됨)
KAKAO_CLIENT_ID=""
KAKAO_CLIENT_SECRET=""
# ==============================================================

service_url() {
  gcloud run services describe "$1" --project "$PROJECT" --region "$REGION" \
    --format='value(status.url)' 2>/dev/null || true
}

# 이미지 빌드 + 푸시 (Cloud Build). $2 = NEXT_PUBLIC_API_BASE_URL
build() {
  SVC="$1"
  API_BASE="${2:-}"
  IMAGE="$REPO/$SVC:latest"
  echo "==> [$SVC] Cloud Build 로 이미지 빌드/푸시"
  gcloud builds submit --project "$PROJECT" \
    --config scripts/deploy/cloudbuild.yaml \
    --substitutions=_SERVICE="$SVC",_IMAGE="$IMAGE",_API_BASE_URL="$API_BASE",_FB_API_KEY="$FB_API_KEY",_FB_AUTH_DOMAIN="$FB_AUTH_DOMAIN",_FB_PROJECT_ID="$FB_PROJECT_ID",_FB_STORAGE_BUCKET="$FB_STORAGE_BUCKET",_FB_MESSAGING_SENDER_ID="$FB_MESSAGING_SENDER_ID",_FB_APP_ID="$FB_APP_ID" \
    .
}

require_api_url() {
  API_URL=$(service_url api)
  if [ -z "$API_URL" ]; then
    echo "!! api 가 먼저 배포돼야 합니다. (./deploy.sh api)"
    exit 1
  fi
  echo "==> api URL = $API_URL"
}

deploy_api() {
  build api ""
  echo "==> [api] Cloud Run 배포 (Cloud SQL 연결 포함)"
  gcloud run deploy api --project "$PROJECT" --region "$REGION" \
    --image "$REPO/api:latest" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$INSTANCE_CONN" \
    --clear-secrets \
    --set-env-vars "^|^DATABASE_URL=$DATABASE_URL"
}

deploy_web() {
  require_api_url
  if [ -z "$NEXTAUTH_SECRET" ]; then
    echo "!! NEXTAUTH_SECRET 가 비어 있습니다. deploy.sh 상단에 \`openssl rand -hex 32\` 값을 채우세요."
    exit 1
  fi
  build web "$API_URL"
  echo "==> [web] Cloud Run 배포"
  ENVS="NEXT_TELEMETRY_DISABLED=1,NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
  if [ -n "$KAKAO_CLIENT_ID" ]; then
    ENVS="$ENVS,KAKAO_CLIENT_ID=$KAKAO_CLIENT_ID,KAKAO_CLIENT_SECRET=$KAKAO_CLIENT_SECRET"
  fi
  gcloud run deploy web --project "$PROJECT" --region "$REGION" \
    --image "$REPO/web:latest" \
    --allow-unauthenticated \
    --clear-secrets \
    --set-env-vars "$ENVS"
  # next-auth 의 NEXTAUTH_URL = web 자신의 URL (배포 후에야 알 수 있어 갱신)
  WEB_URL=$(service_url web)
  echo "==> [web] NEXTAUTH_URL=$WEB_URL 설정"
  gcloud run services update web --project "$PROJECT" --region "$REGION" \
    --update-env-vars "NEXTAUTH_URL=$WEB_URL"
}

deploy_admin() {
  require_api_url
  build admin "$API_URL"
  echo "==> [admin] Cloud Run 배포"
  gcloud run deploy admin --project "$PROJECT" --region "$REGION" \
    --image "$REPO/admin:latest" \
    --allow-unauthenticated
}

case "${1:-all}" in
  api)   deploy_api ;;
  web)   deploy_web ;;
  admin) deploy_admin ;;
  all)   deploy_api; deploy_web; deploy_admin ;;
  *)     echo "usage: ./deploy.sh [api|web|admin|all]"; exit 1 ;;
esac

echo "==> 완료"
