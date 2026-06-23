# Cloud Run 배포

로그인부터 배포까지 아래 스크립트만 실행하면 됩니다.

```bash
# 1) 로그인
gcloud auth login

# 2) 프로젝트 설정
gcloud config set project corn-fbaae

# 3) (최초 1회) 필요한 API 활성화
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# 4) 실행 권한 부여
chmod +x scripts/deploy/deploy.sh

# 5) dev 배포 (기본값)
./scripts/deploy/deploy.sh

# 6) prod 배포
ENV=prod ./scripts/deploy/deploy.sh

# 7) 개별 배포
./scripts/deploy/deploy.sh api
./scripts/deploy/deploy.sh web
./scripts/deploy/deploy.sh admin
```
