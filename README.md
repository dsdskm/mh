# GCP VM 배포

web/admin은 외부에서 접속하고, api는 VM 내부에서만 사용한다.

## 배포

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## 배포 후 SSH에서 확인

```bash
gcloud compute ssh YOUR_VM_NAME --zone asia-northeast3-a

cd /tmp/corn-app
docker compose ps
docker compose logs -f --tail=100 api
docker compose logs -f --tail=100 web
docker compose logs -f --tail=100 admin

# API는 내부 전용이라 VM 안에서 확인
curl http://api:9000/health

# DB 확인
docker exec -it corn-postgres psql -U root -d main -c "select now();"
docker exec -it corn-postgres psql -U root -d main -c "\dt"
```

웹은 배포 후 외부에서 `http://VM_IP:3000`, `http://VM_IP:3100` 으로 확인한다.

## 외부 접속이 안 될 때

```bash
gcloud compute firewall-rules create corn-allow-web \
	--allow tcp:3000,tcp:3100 \
	--direction INGRESS \
	--priority 1000 \
	--network default \
	--target-tags corn-web

gcloud compute instances add-tags corn-vm-instance \
	--zone asia-northeast3-a \
	--tags corn-web
```

VM 안에서 먼저 확인:

```bash
curl -I http://localhost:3000
curl -I http://localhost:3100
```

# Health
docker run --rm --network corn-app_default curlimages/curl:8.10.1 -i http://corn-api:9000/api/health

# vm tunneling
gcloud compute ssh corn-vm-instance --zone asia-northeast3-a -- -L 5432:localhost:5432

# restore
PGPASSWORD=root /opt/homebrew/opt/postgresql@17/bin/pg_restore \
  -h localhost \
  -p 5432 \
  -U root \
  -d main \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --role=root \
  --exit-on-error=0 \
  /Users/kkh/workspace/kkh/corn/backup
