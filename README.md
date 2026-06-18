# Cloud SQL 연결

개발할 때 가장 먼저 Cloud SQL Auth Proxy 를 띄운다 (별도 터미널에서 켜둔 채로):

```bash
./scripts/db/dev-proxy-start.sh
```

내부적으로 아래 명령을 실행한다:

```bash
cloud-sql-proxy corn-fbaae:asia-northeast3:corn-db-instance --port 5432
```

프록시가 떠 있어야 앱(`localhost:5432`)과 pgAdmin/psql 이 Cloud SQL 에 접속된다.

# Cloud Run 배포

3개 서비스(`api`, `web`, `admin`)를 Cloud Run 에 배포한다. 이미지는 모두 같은
Artifact Registry 저장소(`asia-northeast3-docker.pkg.dev/corn-fbaae/corn-repo`)에 들어간다.

## 배포 명령
### 관리자 웹 (`apps/admin`)

- `x-admin-key` 기반 접근
- 대시보드(주문/매출/입금대기/출고준비)
- 주문 상태 변경
- 상품 등록

### API (`apps/api`)

- `GET /api/health`
- `GET /api/config`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/orders`
- `GET /api/orders?phone=...`
- `GET /api/admin/dashboard` (관리자)
- `GET /api/admin/orders` (관리자)
- `PATCH /api/admin/orders/:id/status` (관리자)
- `GET /api/admin/products` (관리자)
- `POST /api/admin/products` (관리자)
- `PATCH /api/admin/products/:id` (관리자)

## 환경 변수

`.env.example` 참고:

- `PORT`: API 포트
- `SHOP_NAME`, `SELLER_NAME`, `SELLER_PHONE`, `SELLER_ORIGIN`: 상단 스토어/판매자 정보
- `BANK_NAME`, `BANK_ACCOUNT`, `BANK_HOLDER`, `TRANSFER_NOTE`: 계좌이체 정보
- `DETAIL_DESCRIPTION`, `STORY_IMAGES`, `PRODUCT_VIDEO_URL`, `RECIPES`: 상품 상세/영상/레시피 데이터
- `ADMIN_KEY`: 관리자 API 키
- `NEXT_PUBLIC_API_BASE_URL`: 웹/관리자에서 호출할 API 주소
- `NEXTAUTH_URL`: 웹 앱 주소(로컬 개발은 `http://localhost:9001`)
- `NEXTAUTH_SECRET`: NextAuth 세션 암호화 시크릿
- `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`: 카카오 로그인 앱 키

카카오 디벨로퍼 설정:

- 플랫폼 Web: `http://localhost:9001`
- Redirect URI: `http://localhost:9001/api/auth/callback/kakao`

## Cloud Run 배포

Cloud Run으로 `api/web/admin` 3개 서비스를 한 번에 배포할 수 있습니다.

```bash
chmod +x deploy/cloudrun/deploy.sh
PROJECT_ID=YOUR_PROJECT_ID REGION=asia-northeast3 ./deploy/cloudrun/deploy.sh
```

자세한 사전 준비(Secret Manager, 권한, 옵션)는 [deploy/cloudrun/README.md](deploy/cloudrun/README.md)를 참고하세요.

## 검증 명령어

```bash
# 전체 배포
./scripts/deploy/deploy.sh           # 또는 ... deploy.sh all

# 개별 배포
./scripts/deploy/deploy.sh api
./scripts/deploy/deploy.sh web
./scripts/deploy/deploy.sh admin
```

각 서비스는 `scripts/deploy/cloudbuild.yaml` 로 이미지를 빌드/푸시한 뒤 Cloud Run 에 배포된다.
빌드는 Cloud Build(linux/amd64)에서 수행하므로 로컬 도커가 없어도 된다.

## 사전 준비 (1회)

시크릿(Secret Manager)은 쓰지 않고, 민감값을 Cloud Run 환경변수로 직접 주입한다.

```bash
# 0) 로그인 / 프로젝트 / 필요한 API
gcloud auth login
gcloud config set project corn-fbaae
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com sqladmin.googleapis.com

# 1) Cloud Run 런타임 SA 에 Cloud SQL 접속 권한
PROJECT_NUMBER=$(gcloud projects describe corn-fbaae --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding corn-fbaae \
  --member="serviceAccount:${SA}" --role=roles/cloudsql.client

# 2) 본인 계정에 배포 권한 (deploy.sh 가 로컬 자격증명으로 run deploy)
#    roles/run.admin + roles/iam.serviceAccountUser
```

그리고 `deploy.sh` 상단 변수를 채운다:

- `DATABASE_URL` — 이미 기본값으로 채워져 있음 (유닉스 소켓 형태, 비밀번호 `#` → `%23`)
- `NEXTAUTH_SECRET` — `openssl rand -hex 32` 로 생성한 값 (web 배포에 필수)
- **admin** Firebase: `FB_API_KEY`, `FB_AUTH_DOMAIN`, `FB_PROJECT_ID`, `FB_STORAGE_BUCKET`,
  `FB_MESSAGING_SENDER_ID`, `FB_APP_ID` (콘솔 > 프로젝트 설정 > 일반 > 내 앱 > SDK 설정)
- **web** 카카오 로그인(선택): `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`

> 민감값(DB 비밀번호 등)이 Cloud Run 서비스 설정에 평문으로 보인다. 더 안전하게
> 가리려면 Secret Manager 방식으로 전환할 수 있다.

## 배포 순서 / 동작

- `deploy.sh` 는 항상 **api 를 먼저 배포**한다. `web`/`admin` 빌드 시 api 의 Cloud Run URL 을
  `NEXT_PUBLIC_API_BASE_URL` (빌드 타임 인라인)로 주입하기 때문이다.
- `web` 배포 후 자신의 URL 을 `NEXTAUTH_URL` 런타임 변수로 갱신한다.
- 값/비밀번호 변경 시 `deploy.sh` 상단 변수를 고치고 재배포한다.

## 참고

- `api` 는 `--add-cloudsql-instances` 로 인스턴스를 연결하고 `DATABASE_URL` 환경변수를 주입받는다.
- `NEXT_PUBLIC_*` 는 빌드 타임에 번들에 박히므로 값 변경 시 **재빌드(재배포)** 가 필요하다.
  Cloud Run 런타임 env 만 바꿔서는 반영되지 않는다.
