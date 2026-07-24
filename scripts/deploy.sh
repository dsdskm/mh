#!/usr/bin/env bash
set -euo pipefail

# VM-only deploy script.
# Defaults are prefilled so this works with only:
#   ./scripts/deploy.sh
# Optional targets:
#   ./scripts/deploy.sh api
#   ./scripts/deploy.sh web admin
#   ./scripts/deploy.sh dev api

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

ENV=${ENV:-prod}
PROJECT_ID=${PROJECT_ID:-corn-fbaae}
ZONE=${ZONE:-asia-northeast3-a}
VM_NAME=${VM_NAME:-corn-vm-instance}
REGION=${REGION:-asia-northeast3}
REPOSITORY=${REPOSITORY:-mh}
REMOTE_DIR=${REMOTE_DIR:-/tmp/corn-app}
PUBLIC_IP=${PUBLIC_IP:-8.230.10.189}

if [[ "$ENV" == "prd" ]]; then
  ENV="prod"
fi

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Error: ENV must be 'dev' or 'prod', got '$ENV'"
  exit 1
fi

POSITIONAL_TARGETS=()
for arg in "$@"; do
  case "$arg" in
    dev|prod|prd)
      ENV="$arg"
      if [[ "$ENV" == "prd" ]]; then
        ENV="prod"
      fi
      ;;
    api|web|admin|all)
      POSITIONAL_TARGETS+=("$arg")
      ;;
    *)
      echo "Error: unknown target '$arg'"
      echo "Use: api | web | admin | all"
      exit 1
      ;;
  esac
done

DEPLOY_API=false
DEPLOY_WEB=false
DEPLOY_ADMIN=false
RUN_WITHOUT_DEPS=false
if [[ ${#POSITIONAL_TARGETS[@]} -eq 0 ]]; then
  DEPLOY_API=true
  DEPLOY_WEB=true
  DEPLOY_ADMIN=true
else
  RUN_WITHOUT_DEPS=true
  for target in "${POSITIONAL_TARGETS[@]}"; do
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
    esac
  done
fi

gcloud config set project "$PROJECT_ID" >/dev/null

echo "=== VM deploy ($ENV) ==="
echo "Project: $PROJECT_ID"
echo "Zone/VM: $ZONE / $VM_NAME"
echo "Targets: API=$DEPLOY_API WEB=$DEPLOY_WEB ADMIN=$DEPLOY_ADMIN"

get_env_file_value() {
  local file_path="$1"
  local key="$2"

  if [[ ! -f "$file_path" ]]; then
    return 0
  fi

  grep -E "^${key}=" "$file_path" | tail -n1 | sed -E "s/^${key}=//; s/^['\"]//; s/['\"]$//"
}

resolve_existing_path() {
  local raw_path="$1"

  if [[ -z "$raw_path" ]]; then
    return 0
  fi

  if [[ "$raw_path" = /* && -f "$raw_path" ]]; then
    echo "$raw_path"
    return 0
  fi

  local candidates=(
    "$ROOT_DIR/$raw_path"
    "$ROOT_DIR/apps/api/$raw_path"
    "$ROOT_DIR/apps/api/${raw_path##*/}"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  return 0
}

if [[ "$ENV" == "prod" ]]; then
  ROOT_ENV_FILE=${ROOT_ENV_FILE:-$ROOT_DIR/.env.prd}
  API_ENV_FILE=${API_ENV_FILE:-$ROOT_DIR/apps/api/.env.prd}
  WEB_ENV_FILE=${WEB_ENV_FILE:-$ROOT_DIR/apps/web/.env.prd}

  # prod 전용 env 파일이 없으면 공통 .env를 기본값으로 사용
  if [[ ! -f "$ROOT_ENV_FILE" && -f "$ROOT_DIR/.env" ]]; then
    ROOT_ENV_FILE="$ROOT_DIR/.env"
    echo "Info: .env.prd not found. Falling back to .env"
  fi
  if [[ ! -f "$API_ENV_FILE" && -f "$ROOT_DIR/apps/api/.env" ]]; then
    API_ENV_FILE="$ROOT_DIR/apps/api/.env"
    echo "Info: apps/api/.env.prd not found. Falling back to apps/api/.env"
  fi
  if [[ ! -f "$WEB_ENV_FILE" && -f "$ROOT_DIR/apps/web/.env" ]]; then
    WEB_ENV_FILE="$ROOT_DIR/apps/web/.env"
    echo "Info: apps/web/.env.prd not found. Falling back to apps/web/.env"
  fi
else
  ROOT_ENV_FILE=${ROOT_ENV_FILE:-$ROOT_DIR/.env}
  API_ENV_FILE=${API_ENV_FILE:-$ROOT_DIR/apps/api/.env}
  WEB_ENV_FILE=${WEB_ENV_FILE:-$ROOT_DIR/apps/web/.env}
fi

if [[ ! -f "$ROOT_ENV_FILE" ]]; then
  echo "Error: env file not found: $ROOT_ENV_FILE"
  exit 1
fi

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

set_env_value() {
  local env_file="$1"
  local key="$2"
  local value="$3"
  local tmp_file

  tmp_file=$(mktemp)
  if grep -q -E "^${key}=" "$env_file"; then
    awk -v key="$key" -v value="$value" 'BEGIN { FS=OFS="=" } $1==key { $0=key"="value } { print }' "$env_file" >"$tmp_file"
  else
    cat "$env_file" >"$tmp_file"
    printf '%s=%s\n' "$key" "$value" >>"$tmp_file"
  fi
  mv "$tmp_file" "$env_file"
}

POSTGRES_DB=${POSTGRES_DB:-main}
POSTGRES_USER=${POSTGRES_USER:-root}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-root}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
API_PORT=${API_PORT:-9000}
WEB_PORT=${WEB_PORT:-3000}
ADMIN_PORT=${ADMIN_PORT:-3100}

ADMIN_AUTH_SECRET=${ADMIN_AUTH_SECRET:-$(get_merged_env_value "$API_ENV_FILE" "ADMIN_AUTH_SECRET")}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-$(get_merged_env_value "$WEB_ENV_FILE" "NEXTAUTH_SECRET")}
KAKAO_REST_API_KEY=${KAKAO_REST_API_KEY:-$(get_merged_env_value "$API_ENV_FILE" "KAKAO_REST_API_KEY")}
if [[ -z "$KAKAO_REST_API_KEY" ]]; then
  KAKAO_REST_API_KEY=$(get_merged_env_value "$WEB_ENV_FILE" "KAKAO_REST_API_KEY")
fi
KAKAO_ADMIN_KEY=${KAKAO_ADMIN_KEY:-$(get_merged_env_value "$API_ENV_FILE" "KAKAO_ADMIN_KEY")}
if [[ -z "$KAKAO_ADMIN_KEY" ]]; then
  KAKAO_ADMIN_KEY=$(get_merged_env_value "$WEB_ENV_FILE" "KAKAO_ADMIN_KEY")
fi
KAKAO_REDIRECT_URI=${KAKAO_REDIRECT_URI:-$(get_merged_env_value "$WEB_ENV_FILE" "KAKAO_REDIRECT_URI")}
NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY=${NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY:-$(get_merged_env_value "$WEB_ENV_FILE" "NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY")}
if [[ -z "$NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY" ]]; then
  NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY=$(get_merged_env_value "$API_ENV_FILE" "NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY")
fi
KAKAO_CLIENT_SECRET=${KAKAO_CLIENT_SECRET:-$(get_merged_env_value "$WEB_ENV_FILE" "KAKAO_CLIENT_SECRET")}
LINK_ID=${LINK_ID:-$(get_merged_env_value "$API_ENV_FILE" "LINK_ID")}
SECRET_KEY=${SECRET_KEY:-$(get_merged_env_value "$API_ENV_FILE" "SECRET_KEY")}
POPBILL_IS_TEST=${POPBILL_IS_TEST:-$(get_merged_env_value "$API_ENV_FILE" "POPBILL_IS_TEST")}
POPBILL_CORP_NUM=${POPBILL_CORP_NUM:-$(get_merged_env_value "$API_ENV_FILE" "POPBILL_CORP_NUM")}
POPBILL_SENDER=${POPBILL_SENDER:-$(get_merged_env_value "$API_ENV_FILE" "POPBILL_SENDER")}
POPBILL_SENDER_NAME=${POPBILL_SENDER_NAME:-$(get_merged_env_value "$API_ENV_FILE" "POPBILL_SENDER_NAME")}
POPBILL_USER_ID=${POPBILL_USER_ID:-$(get_merged_env_value "$API_ENV_FILE" "POPBILL_USER_ID")}
SOLAPI_API_KEY=${SOLAPI_API_KEY:-$(get_merged_env_value "$API_ENV_FILE" "SOLAPI_API_KEY")}
SOLAPI_API_SECRET=${SOLAPI_API_SECRET:-$(get_merged_env_value "$API_ENV_FILE" "SOLAPI_API_SECRET")}
FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET:-$(get_merged_env_value "$API_ENV_FILE" "FIREBASE_STORAGE_BUCKET")}
FIREBASE_SERVICE_ACCOUNT_PATH=${FIREBASE_SERVICE_ACCOUNT_PATH:-$(get_merged_env_value "$API_ENV_FILE" "FIREBASE_SERVICE_ACCOUNT_PATH")}

if [[ -z "$ADMIN_AUTH_SECRET" ]]; then
  echo "Error: ADMIN_AUTH_SECRET is required."
  exit 1
fi

if [[ -z "$NEXTAUTH_SECRET" && "$DEPLOY_WEB" == "true" ]]; then
  echo "Error: NEXTAUTH_SECRET is required when deploying web."
  exit 1
fi

if [[ "$DEPLOY_WEB" == "true" && -z "$NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY" ]]; then
  echo "Error: NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY is required when deploying web."
  exit 1
fi

if [[ "$DEPLOY_WEB" == "true" && -z "$KAKAO_REDIRECT_URI" ]]; then
  echo "Error: KAKAO_REDIRECT_URI is required when deploying web."
  exit 1
fi

if [[ "$DEPLOY_API" == "true" && -z "$KAKAO_ADMIN_KEY" ]]; then
  echo "Error: KAKAO_ADMIN_KEY is required when deploying api."
  exit 1
fi

if [[ "$DEPLOY_API" == "true" ]]; then
  missing_sms_envs=()
  [[ -n "$LINK_ID" ]] || missing_sms_envs+=("LINK_ID")
  [[ -n "$SECRET_KEY" ]] || missing_sms_envs+=("SECRET_KEY")
  [[ -n "$SOLAPI_API_KEY" ]] || missing_sms_envs+=("SOLAPI_API_KEY")
  [[ -n "$SOLAPI_API_SECRET" ]] || missing_sms_envs+=("SOLAPI_API_SECRET")
  [[ -n "$POPBILL_CORP_NUM" ]] || missing_sms_envs+=("POPBILL_CORP_NUM")
  [[ -n "$POPBILL_SENDER" ]] || missing_sms_envs+=("POPBILL_SENDER")

  if [[ ${#missing_sms_envs[@]} -gt 0 ]]; then
    echo "Warning: SMS env missing for API deploy: ${missing_sms_envs[*]}"
  fi

  if [[ -z "$FIREBASE_STORAGE_BUCKET" ]]; then
    echo "Warning: Firebase env missing for API deploy: FIREBASE_STORAGE_BUCKET"
  fi
fi

if [[ -z "$PUBLIC_IP" ]]; then
  PUBLIC_IP=$(gcloud compute instances describe "$VM_NAME" --zone "$ZONE" --format='value(networkInterfaces[0].accessConfigs[0].natIP)' 2>/dev/null || true)
fi
if [[ -z "$PUBLIC_IP" ]]; then
  echo "Error: could not detect VM external IP. Set PUBLIC_IP manually."
  exit 1
fi

NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL-}
NEXTAUTH_URL=${NEXTAUTH_URL:-http://$PUBLIC_IP:$WEB_PORT}
DATABASE_URL=${DATABASE_URL:-postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB}

IMAGE_TAG=${IMAGE_TAG:-$(date +%Y%m%d%H%M)-$ENV}
BASE_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY"
API_IMAGE="$BASE_IMAGE/corn-api:$IMAGE_TAG"
WEB_IMAGE="$BASE_IMAGE/corn-web:$IMAGE_TAG"
ADMIN_IMAGE="$BASE_IMAGE/corn-admin:$IMAGE_TAG"
BUILD_CONFIG="$ROOT_DIR/deploy/cloudbuild-docker.yaml"

echo "Ensuring Artifact Registry repository exists..."
if ! gcloud artifacts repositories describe "$REPOSITORY" --location "$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPOSITORY" \
    --location "$REGION" \
    --repository-format docker
fi

echo "Building and pushing images..."
if [[ "$DEPLOY_API" == "true" ]]; then
  gcloud builds submit "$ROOT_DIR" \
    --config "$BUILD_CONFIG" \
    --substitutions "_DOCKERFILE=deploy/Dockerfile.api,_IMAGE=$API_IMAGE,_APP_ENV=$ENV,_NEXT_PUBLIC_API_BASE_URL="
fi
if [[ "$DEPLOY_WEB" == "true" ]]; then
  gcloud builds submit "$ROOT_DIR" \
    --config "$BUILD_CONFIG" \
    --substitutions "_DOCKERFILE=deploy/Dockerfile.web,_IMAGE=$WEB_IMAGE,_APP_ENV=$ENV,_NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL,_NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY=$NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY"
fi
if [[ "$DEPLOY_ADMIN" == "true" ]]; then
  gcloud builds submit "$ROOT_DIR" \
    --config "$BUILD_CONFIG" \
    --substitutions "_DOCKERFILE=deploy/Dockerfile.admin,_IMAGE=$ADMIN_IMAGE,_APP_ENV=$ENV,_NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL,_NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY=$NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY"
fi

echo "Preparing remote deployment files..."
TMP_ENV_FILE=$(mktemp)
trap 'rm -f "$TMP_ENV_FILE"' EXIT
cat >"$TMP_ENV_FILE" <<EOF
APP_ENV=$ENV
API_IMAGE=$API_IMAGE
WEB_IMAGE=$WEB_IMAGE
ADMIN_IMAGE=$ADMIN_IMAGE
POSTGRES_DB=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_PORT=$POSTGRES_PORT
DATABASE_URL=$DATABASE_URL
ADMIN_AUTH_SECRET=$ADMIN_AUTH_SECRET
NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY=$NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY
NEXTAUTH_URL=$NEXTAUTH_URL
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
KAKAO_REST_API_KEY=$KAKAO_REST_API_KEY
KAKAO_ADMIN_KEY=$KAKAO_ADMIN_KEY
KAKAO_REDIRECT_URI=$KAKAO_REDIRECT_URI
KAKAO_CLIENT_SECRET=$KAKAO_CLIENT_SECRET
LINK_ID=$LINK_ID
SECRET_KEY=$SECRET_KEY
SOLAPI_API_KEY=$SOLAPI_API_KEY
SOLAPI_API_SECRET=$SOLAPI_API_SECRET
POPBILL_IS_TEST=$POPBILL_IS_TEST
POPBILL_CORP_NUM=$POPBILL_CORP_NUM
POPBILL_SENDER=$POPBILL_SENDER
POPBILL_SENDER_NAME=$POPBILL_SENDER_NAME
POPBILL_USER_ID=$POPBILL_USER_ID
FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET
FIREBASE_SERVICE_ACCOUNT_PATH=$FIREBASE_SERVICE_ACCOUNT_PATH
API_PORT=$API_PORT
WEB_PORT=$WEB_PORT
ADMIN_PORT=$ADMIN_PORT
EOF

REMOTE_ENV=""
if [[ "$DEPLOY_API" != "true" || "$DEPLOY_WEB" != "true" || "$DEPLOY_ADMIN" != "true" ]]; then
  REMOTE_ENV=$(gcloud compute ssh "$VM_NAME" --zone "$ZONE" --command "cat '$REMOTE_DIR/.env'" 2>/dev/null || true)
  if [[ -n "$REMOTE_ENV" ]]; then
    if [[ "$DEPLOY_API" != "true" ]]; then
      EXISTING_API_IMAGE=$(printf '%s\n' "$REMOTE_ENV" | grep -E '^API_IMAGE=' | sed -E 's/^API_IMAGE=//' || true)
      if [[ -n "$EXISTING_API_IMAGE" ]]; then
        set_env_value "$TMP_ENV_FILE" "API_IMAGE" "$EXISTING_API_IMAGE"
      fi
    fi
    if [[ "$DEPLOY_WEB" != "true" ]]; then
      EXISTING_WEB_IMAGE=$(printf '%s\n' "$REMOTE_ENV" | grep -E '^WEB_IMAGE=' | sed -E 's/^WEB_IMAGE=//' || true)
      if [[ -n "$EXISTING_WEB_IMAGE" ]]; then
        set_env_value "$TMP_ENV_FILE" "WEB_IMAGE" "$EXISTING_WEB_IMAGE"
      fi
    fi
    if [[ "$DEPLOY_ADMIN" != "true" ]]; then
      EXISTING_ADMIN_IMAGE=$(printf '%s\n' "$REMOTE_ENV" | grep -E '^ADMIN_IMAGE=' | sed -E 's/^ADMIN_IMAGE=//' || true)
      if [[ -n "$EXISTING_ADMIN_IMAGE" ]]; then
        set_env_value "$TMP_ENV_FILE" "ADMIN_IMAGE" "$EXISTING_ADMIN_IMAGE"
      fi
    fi
  fi
fi

gcloud compute ssh "$VM_NAME" --zone "$ZONE" --command "mkdir -p '$REMOTE_DIR'"
gcloud compute scp "$ROOT_DIR/docker-compose.pg.yml" "$VM_NAME:$REMOTE_DIR/docker-compose.yml" --zone "$ZONE" >/dev/null
gcloud compute scp "$TMP_ENV_FILE" "$VM_NAME:$REMOTE_DIR/.env" --zone "$ZONE" >/dev/null

ACCESS_TOKEN=$(gcloud auth print-access-token)

DEPLOY_SERVICES=()
if [[ "$DEPLOY_API" == "true" ]]; then DEPLOY_SERVICES+=(api); fi
if [[ "$DEPLOY_WEB" == "true" ]]; then DEPLOY_SERVICES+=(web); fi
if [[ "$DEPLOY_ADMIN" == "true" ]]; then DEPLOY_SERVICES+=(admin); fi

if [[ "$DEPLOY_API" != "true" && -n "$REMOTE_ENV" ]]; then
  REMOTE_SOLAPI_API_KEY=$(printf '%s\n' "$REMOTE_ENV" | grep -E '^SOLAPI_API_KEY=' | sed -E 's/^SOLAPI_API_KEY=//' || true)
  REMOTE_SOLAPI_API_SECRET=$(printf '%s\n' "$REMOTE_ENV" | grep -E '^SOLAPI_API_SECRET=' | sed -E 's/^SOLAPI_API_SECRET=//' || true)

  if [[ "$REMOTE_SOLAPI_API_KEY" != "$SOLAPI_API_KEY" || "$REMOTE_SOLAPI_API_SECRET" != "$SOLAPI_API_SECRET" ]]; then
    echo "Info: SOLAPI env changed. Including API service restart to apply updated credentials."
    DEPLOY_SERVICES+=(api)
    DEPLOY_API=true
  fi
fi

if [[ ${#DEPLOY_SERVICES[@]} -eq 0 ]]; then
  echo "Error: no services selected for deployment."
  exit 1
fi

SERVICES_ARG="${DEPLOY_SERVICES[*]}"

echo "Deploying on VM with docker compose..."
gcloud compute ssh "$VM_NAME" --zone "$ZONE" --command "\
set -euo pipefail && \
command -v docker >/dev/null && \
cd '$REMOTE_DIR' && \
echo '$ACCESS_TOKEN' | docker login -u oauth2accesstoken --password-stdin https://$REGION-docker.pkg.dev >/dev/null && \
docker compose --env-file .env pull $SERVICES_ARG && \
docker compose --env-file .env up -d ${RUN_WITHOUT_DEPS:+--no-deps }$SERVICES_ARG && \
docker image prune -af >/dev/null 2>&1 || true && \
docker builder prune -af >/dev/null 2>&1 || true && \
docker compose ps\
"

echo "Done"
echo "- API   : http://$PUBLIC_IP:$API_PORT"
echo "- WEB   : http://$PUBLIC_IP:$WEB_PORT"
echo "- ADMIN : http://$PUBLIC_IP:$ADMIN_PORT"
