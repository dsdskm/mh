# Cloud Run Deployment (Monorepo)

This deploys all three services to Cloud Run:

- `apps/api` -> `mh-api`
- `apps/web` -> `mh-web`
- `apps/admin` -> `mh-admin`

## 1) Prerequisites

- Google Cloud project with billing enabled
- APIs enabled:
  - Cloud Run API
  - Cloud Build API
  - Artifact Registry API
  - Secret Manager API
- gcloud authenticated:

```bash
gcloud auth login
gcloud auth application-default login
```

## 2) Create required secrets

Create secrets for **dev** and **prod** environments separately:

### Dev environment

```bash
echo -n 'postgresql://USER:PASS@HOST:5432/DB_DEV' | gcloud secrets create database-url-dev --data-file=-
echo -n 'dev-nextauth-secret-random-string' | gcloud secrets create nextauth-secret-dev --data-file=-
echo -n 'dev-kakao-client-id' | gcloud secrets create kakao-client-id-dev --data-file=-
echo -n 'dev-kakao-client-secret' | gcloud secrets create kakao-client-secret-dev --data-file=-
```

### Prod environment

```bash
echo -n 'postgresql://USER:PASS@HOST:5432/DB_PROD' | gcloud secrets create database-url-prod --data-file=-
echo -n 'prod-nextauth-secret-random-string' | gcloud secrets create nextauth-secret-prod --data-file=-
echo -n 'prod-kakao-client-id' | gcloud secrets create kakao-client-id-prod --data-file=-
echo -n 'prod-kakao-client-secret' | gcloud secrets create kakao-client-secret-prod --data-file=-
```

To update a secret:

```bash
echo -n 'new-value' | gcloud secrets versions add database-url-dev --data-file=-
echo -n 'new-value' | gcloud secrets versions add database-url-prod --data-file=-
```

## 3) Grant runtime access to secrets

Cloud Run runtime service account (usually Compute default or custom SA) needs:

- `roles/secretmanager.secretAccessor`

## 4) Deploy all services

From repo root:

### Deploy to dev

```bash
chmod +x scripts/deploy/cloudrun/deploy.sh
PROJECT_ID=YOUR_PROJECT_ID REGION=asia-northeast3 ENV=dev ./scripts/deploy/cloudrun/deploy.sh
```

### Deploy to prod

```bash
PROJECT_ID=YOUR_PROJECT_ID REGION=asia-northeast3 ENV=prod ./scripts/deploy/cloudrun/deploy.sh
```

Dev/prod will automatically use different:
- Service names (`mh-api-dev` vs `mh-api-prod`)
- Resources (dev: 512Mi/0 min instance, prod: 1Gi/1 min instance)
- Secrets (database-url-dev vs database-url-prod, etc.)

Optional overrides:

```bash
PROJECT_ID=YOUR_PROJECT_ID \
REGION=asia-northeast3 \
ENV=dev \
REPOSITORY=mh \
API_SERVICE=custom-api-name \
./scripts/deploy/cloudrun/deploy.sh
```

## 5) Environment Configuration

| Setting | Dev | Prod |
|---------|-----|------|
| Service suffix | `-dev` | `-prod` |
| CPU | 1 | 2 |
| Memory | 512Mi | 1Gi |
| Min instances | 0 | 1 |
| Max instances | 5 | 20 |
| Secrets suffix | `-dev` | `-prod` |

## 6) Notes

- Script deploys API first, then sets `NEXT_PUBLIC_API_BASE_URL` for web/admin.
- Script updates web `NEXTAUTH_URL` to deployed web URL after first deploy.
- If you use Firebase Admin upload in API, set additional env/secrets:
  - `FIREBASE_STORAGE_BUCKET`
  - `FIREBASE_SERVICE_ACCOUNT_KEY` (or `_BASE64`, `_PATH` strategy)
- Current API enables CORS for all origins. Tighten this for production if needed.
- Each environment has isolated databases and secrets, so dev/prod changes don't affect each other.
