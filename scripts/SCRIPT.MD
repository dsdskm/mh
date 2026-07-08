# Script Guide

`scripts/` 아래 쉘 스크립트의 간단한 실행 방법과 용도 정리입니다.

## DB

### `scripts/db/api-sync.sh`
- 실행: `sh ./scripts/db/api-sync.sh pull`
- 용도: 로컬 API와 서버 API 사이에서 DB 데이터를 REST API로 동기화합니다.

### `scripts/db/db-start.sh`
- 실행: `sh ./scripts/db/db-start.sh`
- 용도: 로컬 개발용 PostgreSQL 관련 컨테이너를 시작합니다.

### `scripts/db/db-stop.sh`
- 실행: `sh ./scripts/db/db-stop.sh`
- 용도: 로컬 개발용 PostgreSQL 관련 컨테이너를 중지하고 정리합니다.

### `scripts/db/mock-clean.sh`
- 실행: `sh ./scripts/db/mock-clean.sh`
- 용도: 개발용 목업 데이터를 데이터베이스에서 제거합니다.

### `scripts/db/mock-seed.sh`
- 실행: `sh ./scripts/db/mock-seed.sh`
- 용도: 개발 확인용 목업 데이터를 데이터베이스에 넣습니다.

### `scripts/db/proxy-start.sh`
- 실행: `sh ./scripts/db/proxy-start.sh`
- 용도: Cloud SQL Auth Proxy를 로컬에서 실행합니다.

### `scripts/db/local-to-server.sh`
- 실행: `sh ./scripts/db/local-to-server.sh --confirm-server-write`
- 용도: 로컬 DB 데이터를 서버 쪽으로 업로드합니다.

### `scripts/db/server-to-local.sh`
- 실행: `sh ./scripts/db/server-to-local.sh`
- 용도: 서버 DB 데이터를 로컬로 내려받습니다.

## Deploy

### `scripts/deploy/set-storage-cors.sh`
- 실행: `sh ./scripts/deploy/set-storage-cors.sh <bucket> <origin...>`
- 용도: 스토리지 버킷의 CORS 설정을 적용합니다.

### `scripts/deploy/deploy.sh`
- 실행: `sh ./scripts/deploy/deploy.sh`
- 용도: Cloud Run용 이미지 빌드와 서비스 배포를 수행합니다.

## Dev

### `scripts/dev/api-start.sh`
- 실행: `sh ./scripts/dev/api-start.sh`
- 용도: API 앱을 개발 모드로 실행합니다.

### `scripts/dev/clear-caches.sh`
- 실행: `sh ./scripts/dev/clear-caches.sh`
- 용도: `.next`, `.turbo`, `dist` 등 개발 캐시를 비웁니다.

### `scripts/dev/kill-port.sh`
- 실행: `sh ./scripts/dev/kill-port.sh 9000 3000`
- 용도: 지정한 포트를 점유한 프로세스를 종료합니다.

### `scripts/dev/run.sh`
- 실행: `sh ./scripts/dev/run.sh api`
- 용도: 전체 또는 특정 앱의 개발 서버를 실행합니다.

### `scripts/dev/sms-test.sh`
- 실행: `sh ./scripts/dev/sms-test.sh 01012345678 "test message"`
- 용도: 관리자 API를 통해 테스트 SMS를 전송합니다.