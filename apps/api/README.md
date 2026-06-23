# API

## Cloud SQL 연동 (로컬 개발)

로컬에서 Cloud SQL Auth Proxy로 접속한다. `apps/api/.env`의 `DATABASE_URL`만 보면 됨.

```bash
# 1. 프록시 실행 (별도 터미널에서 켜둔 채로)
cloud-sql-proxy corn-fbaae:asia-northeast3:corn-db-instance --port 5432

# 2. 앱 실행
pnpm --filter api dev

# 3. 연결 확인
curl localhost:9000/api/health
```

`.env` 예시 (비밀번호의 `#`는 `%23`로 URL 인코딩):

```dotenv
DATABASE_URL=postgresql://postgres:Kk1328911%23@127.0.0.1:5432/postgres
```

## 주요 SQL / gcloud 명령어

```bash
# 인스턴스 목록 + 연결 이름
gcloud sql instances list
gcloud sql instances describe corn-db-instance --format="value(connectionName)"

# 데이터베이스 목록
gcloud sql databases list --instance=corn-db-instance

# 사용자 목록
gcloud sql users list --instance=corn-db-instance

# 비밀번호 재설정
gcloud sql users set-password postgres --instance=corn-db-instance --password='새비밀번호'

# psql 직접 접속 (프록시 실행 중일 때)
psql "postgresql://postgres:Kk1328911%23@127.0.0.1:5432/postgres" -c "select 1"

# 테이블 목록 / 스키마 확인
psql "$DATABASE_URL" -c "\dt"
psql "$DATABASE_URL" -c "\d <테이블명>"
```

## 서버/로컬 데이터베이스 동기화

이 기능은 REST API로 전체 동기화 payload를 내려받아 다른 쪽 API에 그대로 업로드한다.
각 테이블은 기본키 기준으로 추가/갱신(upsert)되며, 대상 DB의 기존 행을 일괄 삭제하지는 않는다.

서버 API에는 충분히 긴 임의 문자열을 `DATABASE_SYNC_SECRET`로 설정하고 먼저
배포해야 한다. 로컬 개발 API는 별도 설정이 없으면
`dev-database-sync-secret-change-me`를 사용한다.

```bash
# 서버 → 로컬
SERVER_DATABASE_SYNC_SECRET='서버에 설정한 값' \
pnpm db:server-to-local

# 로컬 → 서버 (서버 쓰기 확인 플래그 필수)
SERVER_DATABASE_SYNC_SECRET='서버에 설정한 값' \
pnpm db:local-to-server -- --confirm-server-write
```

두 명령은 내부적으로 다음 REST 경로를 사용한다.

```text
GET  /api/backoffice/database-sync/manifest
GET  /api/backoffice/database-sync/export
POST /api/backoffice/database-sync/import
```

필요하면 주소와 로컬 비밀값을 명시할 수 있다.

```bash
SERVER_API_BASE_URL='https://example.com' \
LOCAL_API_BASE_URL='http://localhost:9000' \
SERVER_DATABASE_SYNC_SECRET='...' \
LOCAL_DATABASE_SYNC_SECRET='...' \
pnpm db:server-to-local
```

두 API 모두 실행 중이어야 하며 동일한 버전의 동기화 API가 배포되어 있어야
한다. shell 스크립트는 `curl`로 manifest를 비교한 뒤 export JSON을 import로 전달한다.
