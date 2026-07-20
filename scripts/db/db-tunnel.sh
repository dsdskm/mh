#!/usr/bin/env sh
set -eu

# Cloud SQL Auth Proxy — 로컬에서 localhost:5432 를 Cloud SQL 인스턴스로 터널링.
# 별도 터미널에서 띄워두면 앱/pgAdmin/psql 이 함께 사용한다.

exec cloud-sql-proxy corn-fbaae:asia-northeast3:corn-db-instance --port 5432
