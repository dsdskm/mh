#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/deploy/deploy.sh
#   ENV=prod ./scripts/deploy/deploy.sh
#   PROJECT_ID=my-gcp-project REGION=asia-northeast3 ./scripts/deploy/deploy.sh
#   ./scripts/deploy/deploy.sh api
#   ./scripts/deploy/deploy.sh api dev
#   ./scripts/deploy/deploy.sh dev api
#   ./scripts/deploy/deploy.sh web
#   ./scripts/deploy/deploy.sh admin
#   ./scripts/deploy/deploy.sh api web
#
# Optional:
#   PROJECT_ID: GCP project ID (default: current gcloud project)
#   REGION: Cloud Run region (default: asia-northeast3)
#   ENV: dev or prod (default: prod)
#   ROOT_ENV_FILE / API_ENV_FILE / WEB_ENV_FILE / ADMIN_ENV_FILE: override env file paths
#   API_BASE_URL: web/admin 단독 배포 시 사용할 API URL (default: 기존 API 서비스 URL 조회)
#   DATABASE_URL: API 런타임 DB 연결 문자열
#   NEXTAUTH_SECRET: web 런타임 NextAuth 시크릿
#   KAKAO_CLIENT_ID: web 런타임 카카오 클라이언트 ID
#   KAKAO_CLIENT_SECRET: web 런타임 카카오 클라이언트 시크릿
#   REPOSITORY: Artifact Registry name (default: mh)
#   For custom service names/resources, set individual vars

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
ENV_DELIM="|||"

ENV=${ENV:-prod}

# Allow env to be passed positionally (e.g. ./deploy.sh api dev).
POSITIONAL_TARGETS=()
for arg in "$@"; do
  if [[ "$arg" == "dev" || "$arg" == "prod" ]]; then
    ENV="$arg"
  else
    POSITIONAL_TARGETS+=("$arg")
  fi
done
if [[ ${#POSITIONAL_TARGETS[@]} -gt 0 ]]; then
  set -- "${POSITIONAL_TARGETS[@]}"
else
  set --
fi

PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}
REGION=${REGION:-asia-northeast3}
REPOSITORY=${REPOSITORY:-mh}

if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "(unset)" ]]; then
  echo "Error: PROJECT_ID is not set."
  echo "- Run: gcloud config set project <YOUR_PROJECT_ID>"
  echo "- Or:  PROJECT_ID=<YOUR_PROJECT_ID> ./scripts/deploy/deploy.sh"
  exit 1
fi

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Error: ENV must be 'dev' or 'prod', got '$ENV'"
  exit 1
fi

if [[ "$ENV" == "prod" ]]; then
  ROOT_ENV_FILE=${ROOT_ENV_FILE:-$ROOT_DIR/.env.prd}
  API_ENV_FILE=${API_ENV_FILE:-$ROOT_DIR/apps/api/.env.prd}
  WEB_ENV_FILE=${WEB_ENV_FILE:-$ROOT_DIR/apps/web/.env.prd}
  ADMIN_ENV_FILE=${ADMIN_ENV_FILE:-$ROOT_DIR/.env.prd}
else
  ROOT_ENV_FILE=${ROOT_ENV_FILE:-$ROOT_DIR/.env}
  API_ENV_FILE=${API_ENV_FILE:-$ROOT_DIR/apps/api/.env}
  WEB_ENV_FILE=${WEB_ENV_FILE:-$ROOT_DIR/apps/web/.env}
  ADMIN_ENV_FILE=${ADMIN_ENV_FILE:-$ROOT_DIR/.env}
fi

if [[ ! -f "$ROOT_ENV_FILE" ]]; then
  echo "Error: env file not found: $ROOT_ENV_FILE"
  exit 1
fi

echo "=== Deploying to environment: $ENV ==="

if [[ "$ENV" == "prod" ]]; then
  API_SERVICE=${API_SERVICE:-api}
  WEB_SERVICE=${WEB_SERVICE:-web}
  ADMIN_SERVICE=${ADMIN_SERVICE:-admin}
  DEFAULT_API_BASE_URL=${DEFAULT_API_BASE_URL:-}
  API_CPU=${API_CPU:-2}
  API_MEMORY=${API_MEMORY:-1Gi}
  API_MIN=${API_MIN:-1}
  API_MAX=${API_MAX:-20}
  WEB_CPU=${WEB_CPU:-2}
  WEB_MEMORY=${WEB_MEMORY:-1Gi}
  WEB_MIN=${WEB_MIN:-1}
  WEB_MAX=${WEB_MAX:-20}
  ADMIN_CPU=${ADMIN_CPU:-2}
  ADMIN_MEMORY=${ADMIN_MEMORY:-1Gi}
  ADMIN_MIN=${ADMIN_MIN:-1}
  ADMIN_MAX=${ADMIN_MAX:-10}
else
  API_SERVICE=${API_SERVICE:-api}
  WEB_SERVICE=${WEB_SERVICE:-web}
  ADMIN_SERVICE=${ADMIN_SERVICE:-admin}
  DEFAULT_API_BASE_URL=${DEFAULT_API_BASE_URL:-https://api-251517365320.asia-northeast3.run.app}
  API_CPU=${API_CPU:-1}
  API_MEMORY=${API_MEMORY:-512Mi}
  API_MIN=${API_MIN:-0}
  API_MAX=${API_MAX:-5}
  WEB_CPU=${WEB_CPU:-1}
  WEB_MEMORY=${WEB_MEMORY:-512Mi}
  WEB_MIN=${WEB_MIN:-0}
  WEB_MAX=${WEB_MAX:-5}
  ADMIN_CPU=${ADMIN_CPU:-1}
  ADMIN_MEMORY=${ADMIN_MEMORY:-512Mi}
  ADMIN_MIN=${ADMIN_MIN:-0}
  ADMIN_MAX=${ADMIN_MAX:-3}
fi

echo "Services: $API_SERVICE / $WEB_SERVICE / $ADMIN_SERVICE"
echo "CPU/Memory: API=$API_CPU/$API_MEMORY WEB=$WEB_CPU/$WEB_MEMORY ADMIN=$ADMIN_CPU/$ADMIN_MEMORY"
echo "Scale: API=$API_MIN-$API_MAX WEB=$WEB_MIN-$WEB_MAX ADMIN=$ADMIN_MIN-$ADMIN_MAX"

DEPLOY_API=false
DEPLOY_WEB=false
DEPLOY_ADMIN=false

if [[ $# -eq 0 ]]; then
  DEPLOY_API=true
  DEPLOY_WEB=true
  DEPLOY_ADMIN=true
else
  for target in "$@"; do
    case "$target" in
      all)
        DEPLOY_API=true
        DEPLOY_WEB=true
        DEPLOY_ADMIN=true
        ;;
      api)
        DEPLOY_API=true
        ;;
      web)
        DEPLOY_WEB=true
        ;;
      admin)
        DEPLOY_ADMIN=true
        ;;
      *)
        echo "Error: unknown target '$target'"
        echo "Use: api | web | admin | all"
        exit 1
        ;;
    esac
  done
fi

echo "Targets: API=$DEPLOY_API WEB=$DEPLOY_WEB ADMIN=$DEPLOY_ADMIN"

DATABASE_URL=${DATABASE_URL:-}
ADMIN_AUTH_SECRET=${ADMIN_AUTH_SECRET:-}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-}
KAKAO_CLIENT_ID=${KAKAO_CLIENT_ID:-}
KAKAO_CLIENT_SECRET=${KAKAO_CLIENT_SECRET:-}

IMAGE_TAG=${IMAGE_TAG:-$(date +%Y%m%d%H%M)-$ENV}

gcloud config set project "$PROJECT_ID" >/dev/null

get_env_file_value() {
  local file_path="$1"
  local key="$2"

  if [[ ! -f "$file_path" ]]; then
    return 0
  fi

  grep -E "^${key}=" "$file_path" | tail -n1 | sed -E "s/^${key}=//; s/^['\"]//; s/['\"]$//"
}

get_merged_env_value() {
  local app_file="$1"
  local key="$2"
  local value=""

  value=$(get_env_file_value "$app_file" "$key" || true)
  if [[ -z "$value" ]]; then
    value=$(get_env_file_value "$ROOT_ENV_FILE" "$key" || true)
  fi
  echo "$value"
}

API_BASE_URL=${API_BASE_URL:-$(get_merged_env_value "$WEB_ENV_FILE" "NEXT_PUBLIC_API_BASE_URL")}
if [[ -z "$API_BASE_URL" ]]; then
  API_BASE_URL=$DEFAULT_API_BASE_URL
fi

echo "Ensuring Artifact Registry repository exists..."
if ! gcloud artifacts repositories describe "$REPOSITORY" --location "$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPOSITORY" \
    --location "$REGION" \
    --repository-format docker
fi

BASE_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY"
API_IMAGE="$BASE_IMAGE/$API_SERVICE:$IMAGE_TAG"
WEB_IMAGE="$BASE_IMAGE/$WEB_SERVICE:$IMAGE_TAG"
ADMIN_IMAGE="$BASE_IMAGE/$ADMIN_SERVICE:$IMAGE_TAG"
BUILD_CONFIG="$ROOT_DIR/deploy/cloudbuild-docker.yaml"

echo "Building images..."
if [[ "$DEPLOY_API" == "true" ]]; then
  gcloud builds submit "$ROOT_DIR" \
    --config "$BUILD_CONFIG" \
    --substitutions "_DOCKERFILE=deploy/Dockerfile.api,_IMAGE=$API_IMAGE,_APP_ENV=$ENV,_NEXT_PUBLIC_API_BASE_URL="
fi
if [[ "$DEPLOY_WEB" == "true" ]]; then
  gcloud builds submit "$ROOT_DIR" \
    --config "$BUILD_CONFIG" \
    --substitutions "_DOCKERFILE=deploy/Dockerfile.web,_IMAGE=$WEB_IMAGE,_APP_ENV=$ENV,_NEXT_PUBLIC_API_BASE_URL=$API_BASE_URL"
fi
if [[ "$DEPLOY_ADMIN" == "true" ]]; then
  gcloud builds submit "$ROOT_DIR" \
    --config "$BUILD_CONFIG" \
    --substitutions "_DOCKERFILE=deploy/Dockerfile.admin,_IMAGE=$ADMIN_IMAGE,_APP_ENV=$ENV,_NEXT_PUBLIC_API_BASE_URL=$API_BASE_URL"
fi

if [[ "$DEPLOY_API" == "true" ]]; then
  if [[ -z "$DATABASE_URL" ]]; then
    DATABASE_URL=$(get_merged_env_value "$API_ENV_FILE" "DATABASE_URL" || true)
  fi

  if [[ -z "$ADMIN_AUTH_SECRET" ]]; then
    ADMIN_AUTH_SECRET=$(get_merged_env_value "$API_ENV_FILE" "ADMIN_AUTH_SECRET" || true)
  fi

  if [[ -z "$DATABASE_URL" ]]; then
    echo "Error: DATABASE_URL is empty."
    echo "- Export DATABASE_URL and rerun, or deploy once with DATABASE_URL set."
    exit 1
  fi

  if [[ -z "$ADMIN_AUTH_SECRET" ]]; then
    echo "Error: ADMIN_AUTH_SECRET is empty."
    echo "- Set ADMIN_AUTH_SECRET in apps/api/.env(.prd) or export it before deploy."
    exit 1
  fi

  gcloud run services update "$API_SERVICE" \
    --region "$REGION" \
    --remove-secrets "DATABASE_URL" >/dev/null 2>&1 || true

  echo "Deploying API service..."
  gcloud run deploy "$API_SERVICE" \
    --image "$API_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --timeout 600 \
    --cpu "$API_CPU" \
    --memory "$API_MEMORY" \
    --min-instances "$API_MIN" \
    --max-instances "$API_MAX" \
    --set-env-vars "^${ENV_DELIM}^NODE_ENV=production${ENV_DELIM}APP_ENV=$ENV${ENV_DELIM}DATABASE_URL=$DATABASE_URL${ENV_DELIM}ADMIN_AUTH_SECRET=$ADMIN_AUTH_SECRET"
fi

if [[ "$DEPLOY_API" == "true" ]]; then
  API_URL=$(gcloud run services describe "$API_SERVICE" --region "$REGION" --format='value(status.url)')
elif [[ "$DEPLOY_WEB" == "true" || "$DEPLOY_ADMIN" == "true" ]]; then
  if [[ -n "$API_BASE_URL" ]]; then
    API_URL="$API_BASE_URL"
  else
    API_URL=$(get_env_file_value "$WEB_ENV_FILE" "NEXT_PUBLIC_API_BASE_URL" || true)
    if [[ -z "${API_URL:-}" ]]; then
      API_URL=$(get_env_file_value "$ADMIN_ENV_FILE" "NEXT_PUBLIC_API_BASE_URL" || true)
    fi
    if [[ -z "${API_URL:-}" ]]; then
      API_URL="$DEFAULT_API_BASE_URL"
    fi
  fi
fi
if [[ -n "${API_URL:-}" ]]; then
  echo "API_URL=$API_URL"
fi

if [[ "$DEPLOY_WEB" == "true" ]]; then
  if [[ -z "$NEXTAUTH_SECRET" ]]; then
    NEXTAUTH_SECRET=$(get_merged_env_value "$WEB_ENV_FILE" "NEXTAUTH_SECRET" || true)
  fi

  if [[ -z "$KAKAO_CLIENT_ID" ]]; then
    KAKAO_CLIENT_ID=$(get_merged_env_value "$WEB_ENV_FILE" "KAKAO_CLIENT_ID" || true)
  fi

  if [[ -z "$KAKAO_CLIENT_SECRET" ]]; then
    KAKAO_CLIENT_SECRET=$(get_merged_env_value "$WEB_ENV_FILE" "KAKAO_CLIENT_SECRET" || true)
  fi

  gcloud run services update "$WEB_SERVICE" \
    --region "$REGION" \
    --remove-secrets "NEXTAUTH_SECRET,KAKAO_CLIENT_ID,KAKAO_CLIENT_SECRET" >/dev/null 2>&1 || true

  WEB_ENV_VARS="NODE_ENV=production${ENV_DELIM}APP_ENV=$ENV${ENV_DELIM}NEXT_PUBLIC_APP_ENV=$ENV"
  if [[ -n "${API_URL:-}" ]]; then
    WEB_ENV_VARS="$WEB_ENV_VARS${ENV_DELIM}NEXT_PUBLIC_API_BASE_URL=$API_URL"
  else
    echo "Warning: API URL is empty. Keeping existing NEXT_PUBLIC_API_BASE_URL on service if present."
  fi
  if [[ -n "$NEXTAUTH_SECRET" ]]; then
    WEB_ENV_VARS="$WEB_ENV_VARS${ENV_DELIM}NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
  fi
  if [[ -n "$KAKAO_CLIENT_ID" ]]; then
    WEB_ENV_VARS="$WEB_ENV_VARS${ENV_DELIM}KAKAO_CLIENT_ID=$KAKAO_CLIENT_ID"
  fi
  if [[ -n "$KAKAO_CLIENT_SECRET" ]]; then
    WEB_ENV_VARS="$WEB_ENV_VARS${ENV_DELIM}KAKAO_CLIENT_SECRET=$KAKAO_CLIENT_SECRET"
  fi

  echo "Deploying Web service..."
  gcloud run deploy "$WEB_SERVICE" \
    --image "$WEB_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --timeout 600 \
    --cpu "$WEB_CPU" \
    --memory "$WEB_MEMORY" \
    --min-instances "$WEB_MIN" \
    --max-instances "$WEB_MAX" \
    --set-env-vars "^${ENV_DELIM}^$WEB_ENV_VARS"

  WEB_URL=$(gcloud run services describe "$WEB_SERVICE" --region "$REGION" --format='value(status.url)')
  echo "WEB_URL=$WEB_URL"

  gcloud run services update "$WEB_SERVICE" \
    --region "$REGION" \
    --update-env-vars "NEXTAUTH_URL=$WEB_URL"
fi

if [[ "$DEPLOY_ADMIN" == "true" ]]; then
  ADMIN_ENV_VARS="NODE_ENV=production${ENV_DELIM}APP_ENV=$ENV${ENV_DELIM}NEXT_PUBLIC_APP_ENV=$ENV"
  if [[ -n "${API_URL:-}" ]]; then
    ADMIN_ENV_VARS="$ADMIN_ENV_VARS${ENV_DELIM}NEXT_PUBLIC_API_BASE_URL=$API_URL"
  else
    echo "Warning: API URL is empty. Keeping existing NEXT_PUBLIC_API_BASE_URL on service if present."
  fi

  echo "Deploying Admin service..."
  gcloud run deploy "$ADMIN_SERVICE" \
    --image "$ADMIN_IMAGE" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --timeout 600 \
    --cpu "$ADMIN_CPU" \
    --memory "$ADMIN_MEMORY" \
    --min-instances "$ADMIN_MIN" \
    --max-instances "$ADMIN_MAX" \
    --set-env-vars "^${ENV_DELIM}^$ADMIN_ENV_VARS"

  ADMIN_URL=$(gcloud run services describe "$ADMIN_SERVICE" --region "$REGION" --format='value(status.url)')
fi

echo "Done"
if [[ -n "${API_URL:-}" ]]; then echo "- API   : $API_URL"; fi
if [[ -n "${WEB_URL:-}" ]]; then echo "- WEB   : $WEB_URL"; fi
if [[ -n "${ADMIN_URL:-}" ]]; then echo "- ADMIN : $ADMIN_URL"; fi
