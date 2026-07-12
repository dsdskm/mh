# Web App

Next.js 16 기반 웹 앱입니다. 기본 개발 포트는 `9001`입니다.

## 실행

레포 루트에서 의존성을 설치한 뒤 웹 앱만 실행합니다.

```bash
pnpm install
pnpm --filter web dev
```

브라우저에서 확인:

```text
http://localhost:9001
```

프로덕션 실행:

```bash
pnpm --filter web build
pnpm --filter web start
```

## 빌드

웹 앱은 Next.js production build를 사용합니다.

```bash
pnpm --filter web build
```

타입/린트 확인이 필요하면:

```bash
pnpm --filter web check-types
pnpm --filter web lint
```

## 환경 변수

웹 앱이 직접 사용하는 주요 환경 변수는 다음과 같습니다.

- `NEXT_PUBLIC_API_BASE_URL`: API 기본 URL
- `NEXTAUTH_URL`: NextAuth가 사용할 공개 URL
- `NEXTAUTH_SECRET`: NextAuth 세션 비밀키
- `NEXT_PUBLIC_KAKAO_REST_API_KEY` 또는 `KAKAO_REST_API_KEY`: 카카오 REST 로그인
- `KAKAO_REDIRECT_URI`: 카카오 콜백 URI 오버라이드
- `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`: NextAuth Kakao provider용
- `INTERNAL_API_BASE_URL`: 서버 내부에서 API 호출 시 우선 사용

배포용 값은 보통 레포 루트의 `.env.prd`, `apps/web/.env.prd`, `apps/api/.env.prd`에서 읽습니다.

## GCP VM 배포

이 레포는 Vercel이 아니라 GCP VM + Docker Compose 방식으로 배포합니다.

기본 배포 명령은 레포 루트에서 실행합니다.

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

특정 서비스만 배포할 수도 있습니다.

```bash
./scripts/deploy.sh web
./scripts/deploy.sh api
./scripts/deploy.sh admin
./scripts/deploy.sh all
```

기본 GCP 배포 값은 다음과 같습니다.

- `PROJECT_ID=corn-fbaae`
- `REGION=asia-northeast3`
- `ZONE=asia-northeast3-a`
- `VM_NAME=corn-vm-instance`
- `REPOSITORY=mh`
- `REMOTE_DIR=/tmp/corn-app`
- `PUBLIC_IP=8.230.10.189`

배포 시 열리는 포트와 역할은 다음과 같습니다.

- `api`: `9000` 내부 전용
- `web`: `3000`
- `admin`: `3100`

배포 스크립트는 API/웹/관리자용 env를 병합해서 VM의 `/tmp/corn-app/.env`로 전달합니다. 특히 SMS 발송은 API 쪽에서 `SOLAPI_API_KEY`와 `SOLAPI_API_SECRET`이 필요합니다.

## 배포 후 확인

VM SSH 접속 후 확인합니다.

```bash
gcloud compute ssh corn-vm-instance --zone asia-northeast3-a
cd /tmp/corn-app
docker compose ps
docker compose logs -f --tail=100 web
```

웹과 관리자 화면은 외부에서 다음 주소로 확인합니다.

```text
http://8.230.10.189:3000
http://8.230.10.189:3100
```

API 상태는 VM 안에서 확인합니다.

```bash
curl http://api:9000/health
```

## 참고

- 웹 앱의 카카오 콜백은 `/auth/kakao/callback`입니다.
- 모바일 화면에서는 작은 폭에서 입력 행이 줄바꿈되지 않도록 1열 우선 레이아웃을 사용합니다.
