# 빌드 컨텍스트 = 레포 루트. (docker build -f apps/web/Dockerfile .)
# Next.js standalone 출력. 빌드 결과가 자체 포함되므로 워크스페이스 의존성 문제 없음.

FROM node:24-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
# NEXT_PUBLIC_* 는 빌드 타임에 번들에 인라인되므로 build-arg 로 받아 ENV 로 노출한다.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
COPY . .
RUN pnpm install --frozen-lockfile
# turbo 가 ^build 의존성(@repo/shared-types)을 먼저 빌드한 뒤 web 을 빌드한다.
RUN pnpm exec turbo run build --filter=web

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
# standalone 서버 + 정적 파일 (outputFileTracingRoot=레포루트 기준 레이아웃)
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
# Cloud Run 이 PORT(기본 8080)를 주입. Next standalone 서버가 PORT 를 사용.
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
