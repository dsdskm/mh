# 옥수수 쇼핑몰 모노레포

PC/모바일 대응 고객 쇼핑몰 + 관리자 웹 + Nest 백엔드를 Turborepo로 구성한 프로젝트입니다.

결제 방식은 PG 연동 없이 계좌이체 기반입니다.

## 기술 스택

- Monorepo: Turborepo + pnpm workspaces
- Frontend: Next.js App Router (`apps/web`, `apps/admin`)
- Backend: NestJS (`apps/api`)
- Styling: Tailwind CSS
- Language: TypeScript
- Storage: 서버 메모리 기반(MVP)

## 앱 구성

- `apps/web`: 옥수수 쇼핑몰 고객 웹
- `apps/admin`: 옥수수 쇼핑몰 관리 웹
- `apps/api`: 상품/주문/관리 API

## 빠른 시작

```bash
pnpm install
cp .env.example .env
pnpm dev
```

기본 주소:

- 웹: http://localhost:3000
- 관리자: http://localhost:3001
- API: http://localhost:3002

개별 실행:

```bash
pnpm dev:web
pnpm dev:admin
pnpm dev:api
```

## 주요 기능

### 고객 웹 (`apps/web`)

- 반응형 상품 리스트(모바일/PC)
- 장바구니 수량 조절
- 주문자/입금자/연락처/배송지 입력
- 계좌이체 주문 접수
- 주문 완료 시 주문번호 + 입금계좌 안내

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
- `NEXTAUTH_URL`: 웹 앱 주소(로컬 개발은 `http://localhost:3000`)
- `NEXTAUTH_SECRET`: NextAuth 세션 암호화 시크릿
- `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`: 카카오 로그인 앱 키

카카오 디벨로퍼 설정:

- 플랫폼 Web: `http://localhost:3000`
- Redirect URI: `http://localhost:3000/api/auth/callback/kakao`

## 검증 명령어

```bash
pnpm check-types
pnpm lint
pnpm build
```
