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
