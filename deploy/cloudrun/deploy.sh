#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   PROJECT_ID=my-gcp-project REGION=asia-northeast3 ENV=dev ./deploy/cloudrun/deploy.sh
#   PROJECT_ID=my-gcp-project REGION=asia-northeast3 ENV=prod ./deploy/cloudrun/deploy.sh
#
# Required:
#   PROJECT_ID: GCP project ID
#   REGION: Cloud Run region (e.g., asia-northeast3)
#   ENV: dev or prod (default: dev)
#
# Optional:
#   REPOSITORY: Artifact Registry name (default: mh)
#   For custom service names/resources, set individual vars

PROJECT_ID=${PROJECT_ID:?PROJECT_ID is required}
REGION=${REGION:?REGION is required}
ENV=${ENV:-dev}
REPOSITORY=${REPOSITORY:-mh}

if [[ "$ENV" != "dev" && "$ENV" != "prod" ]]; then
  echo "Error: ENV must be 'dev' or 'prod', got '$ENV'"
  exit 1
fi

echo "=== Deploying to environment: $ENV ==="

if [[ "$ENV" == "prod" ]]; then
  API_SERVICE=${API_SERVICE:-mh-api-prod}
  WEB_SERVICE=${WEB_SERVICE:-mh-web-prod}
  ADMIN_SERVICE=${ADMIN_SERVICE:-mh-admin-prod}
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
  API_SERVICE=${API_SERVICE:-mh-api-dev}
  WEB_SERVICE=${WEB_SERVICE:-mh-web-dev}
  ADMIN_SERVICE=${ADMIN_SERVICE:-mh-admin-dev}
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

DATABASE_URL_SECRET=${DATABASE_URL_SECRET:-database-url-${ENV}}
NEXTAUTH_SECRET_SECRET=${NEXTAUTH_SECRET_SECRET:-nextauth-secret-${ENV}}
KAKAO_CLIENT_ID_SECRET=${KAKAO_CLIENT_ID_SECRET:-kakao-client-id-${ENV}}
KAKAO_CLIENT_SECRET_SECRET=${KAKAO_CLIENT_SECRET_SECRET:-kakao-client-secret-${ENV}}

IMAGE_TAG=${IMAGE_TAG:-$(date +%Y%m%d%H%M)}

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

gcloud config set project "$PROJECT_ID" >/dev/null

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

echo "Building images..."
gcloud builds submit "$ROOT_DIR" --tag "$API_IMAGE" --file "$ROOT_DIR/deploy/cloudrun/Dockerfile.api"
gcloud builds submit "$ROOT_DIR" --tag "$WEB_IMAGE" --file "$ROOT_DIR/deploy/cloudrun/Dockerfile.web"
gcloud builds submit "$ROOT_DIR" --tag "$ADMIN_IMAGE" --file "$ROOT_DIR/deploy/cloudrun/Dockerfile.admin"

echo "Deploying API service..."
gcloud run deploy "$API_SERVICE" \
  --image "$API_IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --cpu "$API_CPU" \
  --memory "$API_MEMORY" \
  --min-instances "$API_MIN" \
  --max-instances "$API_MAX" \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "DATABASE_URL=$DATABASE_URL_SECRET:latest"

API_URL=$(gcloud run services describe "$API_SERVICE" --region "$REGION" --format='value(status.url)')
echo "API_URL=$API_URL"

echo "Deploying Web service..."
gcloud run deploy "$WEB_SERVICE" \
  --image "$WEB_IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --cpu "$WEB_CPU" \
  --memory "$WEB_MEMORY" \
  --min-instances "$WEB_MIN" \
  --max-instances "$WEB_MAX" \
  --set-env-vars "NODE_ENV=production,NEXT_PUBLIC_API_BASE_URL=$API_URL" \
  --set-secrets "NEXTAUTH_SECRET=$NEXTAUTH_SECRET_SECRET:latest,KAKAO_CLIENT_ID=$KAKAO_CLIENT_ID_SECRET:latest,KAKAO_CLIENT_SECRET=$KAKAO_CLIENT_SECRET_SECRET:latest"

WEB_URL=$(gcloud run services describe "$WEB_SERVICE" --region "$REGION" --format='value(status.url)')
echo "WEB_URL=$WEB_URL"

# NEXTAUTH_URL must point to the deployed web URL.
gcloud run services update "$WEB_SERVICE" \
  --region "$REGION" \
  --update-env-vars "NEXTAUTH_URL=$WEB_URL"

echo "Deploying Admin service..."
gcloud run deploy "$ADMIN_SERVICE" \
  --image "$ADMIN_IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --cpu "$ADMIN_CPU" \
  --memory "$ADMIN_MEMORY" \
  --min-instances "$ADMIN_MIN" \
  --max-instances "$ADMIN_MAX" \
  --set-env-vars "NODE_ENV=production,NEXT_PUBLIC_API_BASE_URL=$API_URL"

ADMIN_URL=$(gcloud run services describe "$ADMIN_SERVICE" --region "$REGION" --format='value(status.url)')

echo "Done"
echo "- API   : $API_URL"
echo "- WEB   : $WEB_URL"
echo "- ADMIN : $ADMIN_URL"
