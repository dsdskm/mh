-- HARD DIET (destructive): accounts_kakao 분리 + accounts 카카오 전용 컬럼 제거.
-- 정책:
-- 1) accounts: 기존 범용 컬럼 유지
-- 2) accounts_kakao: 카카오 원본(raw) + 치환(normalized) 저장

-- pgAdmin Query Tool에서 이전 실패 트랜잭션이 남아 있을 수 있으므로 먼저 정리
ROLLBACK;

-- 1) 카카오 전용 분리 테이블 생성
CREATE TABLE IF NOT EXISTS accounts_kakao (
  id serial PRIMARY KEY,
  account_id int NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  provider_user_id varchar NULL,
  raw_user jsonb NULL,
  raw_shipping jsonb NULL,
  nickname varchar NULL,
  profile_image_url varchar NULL,
  profile_thumbnail_url varchar NULL,
  shipping_name varchar NULL,
  shipping_receiver_name varchar NULL,
  shipping_receiver_phone1 varchar NULL,
  shipping_receiver_phone2 varchar NULL,
  shipping_postal_code varchar NULL,
  synced_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1-1) accounts에 우편번호 저장 컬럼 추가 (프로필 수정은 accounts만 갱신)
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS postal_code varchar NULL;

-- 2) accounts의 카카오 전용 컬럼 제거
ALTER TABLE accounts
  DROP COLUMN IF EXISTS "type",
  DROP COLUMN IF EXISTS kakao_nickname,
  DROP COLUMN IF EXISTS kakao_profile_image_url,
  DROP COLUMN IF EXISTS kakao_thumbnail_image_url,
  DROP COLUMN IF EXISTS kakao_shipping_name,
  DROP COLUMN IF EXISTS kakao_shipping_receiver_name,
  DROP COLUMN IF EXISTS kakao_shipping_receiver_phone1,
  DROP COLUMN IF EXISTS kakao_shipping_receiver_phone2,
  DROP COLUMN IF EXISTS kakao_shipping_zone_number,
  DROP COLUMN IF EXISTS kakao_synced_at;

-- 3) 배송지 목록 기능 제거: 배송지 테이블 삭제
DROP TABLE IF EXISTS account_shipping_addresses;

-- Verify #1: accounts 컬럼
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts'
ORDER BY ordinal_position;

-- Verify #2: accounts_kakao 컬럼
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts_kakao'
ORDER BY ordinal_position;

-- Verify #3: 분리 테이블 현재 건수
SELECT COUNT(*) AS accounts_kakao_rows
FROM accounts_kakao;
