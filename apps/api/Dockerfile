# 빌드 컨텍스트 = 레포 루트. (docker build -f apps/api/Dockerfile .)
# NestJS API. 런타임에 @repo/shared-types 를 require 하며, 이 패키지는 빌드되어
# packages/shared-types/dist 의 CommonJS 로 해석된다(결정론적, 타입 스트리핑 불필요).
# 워크스페이스 레이아웃(node_modules 심볼릭링크 + packages/dist)을 그대로 보존한다.

FROM node:24-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
COPY . .
RUN pnpm install --frozen-lockfile
# turbo 가 ^build 의존성(@repo/shared-types)을 먼저 빌드한 뒤 api 를 빌드한다.
RUN pnpm exec turbo run build --filter=api

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# 워크스페이스 구조 보존: 루트 .pnpm 저장소 + api 패키지의 node_modules(심볼릭링크)
# + packages 소스 + api dist. apps/api/node_modules 가 있어야 @nestjs/pg 등이 해석된다.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
# Cloud Run 은 PORT 환경변수를 주입한다 (기본 8080). main.ts 가 이를 사용.
EXPOSE 8080
CMD ["node", "apps/api/dist/main.js"]
