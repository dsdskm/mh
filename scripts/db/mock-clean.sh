#!/usr/bin/env sh
# ---------------------------------------------------------------------------
# Mock 데이터 정리 스크립트
#   dev-mock-seed.sh 로 생성한 mock 데이터만 정확히 삭제합니다.
#   (마커: products '[MOCK]%', accounts 'mockuser%', 문의/후기 id 'MOCK-%',
#    주문 id 2000010100000~2000010299999 범위)
#
# 기본정보(app_settings)는 시드가 만들지 않으므로 이 스크립트도 삭제하지 않습니다.
#
# FK 제약을 고려해 자식 → 부모 순서로 삭제합니다.
# ---------------------------------------------------------------------------
set -eu

DATABASE_URL="${DATABASE_URL:-postgresql://root:root@localhost:5432/main}"

echo "[mock-clean] DATABASE_URL=$DATABASE_URL"
echo "[mock-clean] mock 데이터를 삭제합니다..."

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

-- 문의 / 후기 답글
DELETE FROM inquiry_comments WHERE id LIKE 'MOCK-%' OR "inquiryId" LIKE 'MOCK-%';
DELETE FROM review_comments  WHERE id LIKE 'MOCK-%' OR "reviewId"  LIKE 'MOCK-%';

-- 문의 / 후기
DELETE FROM inquiries WHERE id LIKE 'MOCK-%';
DELETE FROM reviews   WHERE id LIKE 'MOCK-%';

-- 주문 / 주문항목 정리 (상품보다 먼저)
--  · mock 주문(2000-01-xx 범위)
--  · mock 상품([MOCK])을 참조하는 테스트 주문까지 함께 제거
--  (order_items.orderId 는 ON DELETE CASCADE 이므로 주문 삭제 시 항목도 함께 삭제됩니다.)
DELETE FROM orders
 WHERE (id >= 2000010100000 AND id < 2000010300000)
    OR id IN (
      SELECT DISTINCT "orderId" FROM order_items
       WHERE "productId" IN (SELECT id FROM products WHERE name LIKE '[MOCK]%')
    );

-- 혹시 CASCADE 가 없는 환경을 대비해 mock 상품 참조 항목을 한 번 더 정리
DELETE FROM order_items
 WHERE "productId" IN (SELECT id FROM products WHERE name LIKE '[MOCK]%');

-- 배송지 → 사용자 (MASTER 관리자 계정은 건드리지 않음)
DELETE FROM account_shipping_addresses
 WHERE "accountId" IN (SELECT id FROM accounts WHERE "userId" LIKE 'mockuser%');
DELETE FROM accounts WHERE "userId" LIKE 'mockuser%' AND "type" = 'NORMAL';

-- 상품: 옥수수 mock 상품 (주문 항목 삭제 후 마지막에)
DELETE FROM products WHERE name LIKE '[MOCK]%';

COMMIT;
SQL

echo "[mock-clean] 완료."
