-- DANGER: accounts 테이블을 type 중심으로 최소화합니다.
-- 실행 전 반드시 백업을 확인하세요.

BEGIN;

-- 1) 백업 테이블 생성 (이미 있으면 재생성하지 않음)
CREATE TABLE IF NOT EXISTS accounts_backup_20260720 AS
SELECT * FROM accounts;

-- 2) 불필요 컬럼 제거 (id, type만 유지)
ALTER TABLE accounts
  DROP COLUMN IF EXISTS userId,
  DROP COLUMN IF EXISTS username,
  DROP COLUMN IF EXISTS password,
  DROP COLUMN IF EXISTS providerUserId,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS displayName,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS address1,
  DROP COLUMN IF EXISTS address2,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS statusReason,
  DROP COLUMN IF EXISTS termsAgreed,
  DROP COLUMN IF EXISTS termsAgreedAt,
  DROP COLUMN IF EXISTS phoneVerifiedAt,
  DROP COLUMN IF EXISTS isActive,
  DROP COLUMN IF EXISTS mileageBalance,
  DROP COLUMN IF EXISTS createdAt,
  DROP COLUMN IF EXISTS updatedAt,
  DROP COLUMN IF EXISTS kakao_nickname,
  DROP COLUMN IF EXISTS kakao_profile_image_url,
  DROP COLUMN IF EXISTS kakao_thumbnail_image_url,
  DROP COLUMN IF EXISTS kakao_shipping_name,
  DROP COLUMN IF EXISTS kakao_shipping_receiver_name,
  DROP COLUMN IF EXISTS kakao_shipping_receiver_phone1,
  DROP COLUMN IF EXISTS kakao_shipping_receiver_phone2,
  DROP COLUMN IF EXISTS kakao_shipping_zone_number,
  DROP COLUMN IF EXISTS kakao_synced_at;

-- 3) type 제약 보강
ALTER TABLE accounts
  ALTER COLUMN type SET NOT NULL;

-- 4) 기존 인덱스 정리
DROP INDEX IF EXISTS IDX_accounts_type_providerUserId;
DROP INDEX IF EXISTS IDX_accounts_userId;
DROP INDEX IF EXISTS IDX_accounts_phone;

COMMIT;

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts'
ORDER BY ordinal_position;
