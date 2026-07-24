-- Phase 2 (destructive): remove legacy account columns after app code is switched to neutral columns.
-- Run this only after deploying API/Web/Admin code that no longer reads/writes the dropped columns.

BEGIN;

-- Backup snapshot (idempotent)
CREATE TABLE IF NOT EXISTS accounts_backup_20260722_1020 AS
SELECT * FROM accounts;

-- Safety check: neutral columns must already contain migrated values.
DO $$
DECLARE
  missing_count bigint;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM accounts
  WHERE ("providerUserId" IS NOT NULL AND auth_subject IS NULL)
     OR (kakao_nickname IS NOT NULL AND profile_nickname IS NULL)
     OR (kakao_profile_image_url IS NOT NULL AND profile_image_url IS NULL)
     OR (kakao_thumbnail_image_url IS NOT NULL AND profile_thumbnail_url IS NULL)
     OR (kakao_shipping_name IS NOT NULL AND shipping_name IS NULL)
     OR (kakao_shipping_receiver_name IS NOT NULL AND shipping_receiver_name IS NULL)
     OR (kakao_shipping_receiver_phone1 IS NOT NULL AND shipping_receiver_phone1 IS NULL)
     OR (kakao_shipping_receiver_phone2 IS NOT NULL AND shipping_receiver_phone2 IS NULL)
     OR (kakao_shipping_zone_number IS NOT NULL AND shipping_postal_code IS NULL)
     OR (kakao_synced_at IS NOT NULL AND profile_synced_at IS NULL);

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Cutover blocked: % rows still have non-migrated legacy profile values.', missing_count;
  END IF;
END
$$;

-- Remove legacy columns with provider-specific names.
ALTER TABLE accounts
  DROP COLUMN IF EXISTS "providerUserId",
  DROP COLUMN IF EXISTS kakao_nickname,
  DROP COLUMN IF EXISTS kakao_profile_image_url,
  DROP COLUMN IF EXISTS kakao_thumbnail_image_url,
  DROP COLUMN IF EXISTS kakao_shipping_name,
  DROP COLUMN IF EXISTS kakao_shipping_receiver_name,
  DROP COLUMN IF EXISTS kakao_shipping_receiver_phone1,
  DROP COLUMN IF EXISTS kakao_shipping_receiver_phone2,
  DROP COLUMN IF EXISTS kakao_shipping_zone_number,
  DROP COLUMN IF EXISTS kakao_synced_at;

-- Remove known duplicate legacy column if it still exists.
ALTER TABLE accounts
  DROP COLUMN IF EXISTS "username";

-- Remove old index and keep neutral index.
DROP INDEX IF EXISTS "IDX_accounts_type_providerUserId";
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_auth_provider_subject
  ON accounts (auth_provider, auth_subject)
  WHERE auth_subject IS NOT NULL;

COMMIT;

-- Verify final shape for social/profile columns.
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name IN (
    'auth_provider',
    'auth_subject',
    'profile_nickname',
    'profile_image_url',
    'profile_thumbnail_url',
    'shipping_name',
    'shipping_receiver_name',
    'shipping_receiver_phone1',
    'shipping_receiver_phone2',
    'shipping_postal_code',
    'profile_synced_at'
  )
ORDER BY column_name;
