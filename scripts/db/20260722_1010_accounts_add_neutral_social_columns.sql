-- Phase 1 (safe): add neutral social-profile columns and backfill from legacy account columns.
-- This script is non-breaking for the current application because old columns are kept.

BEGIN;

-- Backup snapshot (idempotent)
CREATE TABLE IF NOT EXISTS accounts_backup_20260722_1010 AS
SELECT * FROM accounts;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS auth_provider varchar NULL,
  ADD COLUMN IF NOT EXISTS auth_subject varchar NULL,
  ADD COLUMN IF NOT EXISTS profile_nickname varchar NULL,
  ADD COLUMN IF NOT EXISTS profile_image_url varchar NULL,
  ADD COLUMN IF NOT EXISTS profile_thumbnail_url varchar NULL,
  ADD COLUMN IF NOT EXISTS shipping_name varchar NULL,
  ADD COLUMN IF NOT EXISTS shipping_receiver_name varchar NULL,
  ADD COLUMN IF NOT EXISTS shipping_receiver_phone1 varchar NULL,
  ADD COLUMN IF NOT EXISTS shipping_receiver_phone2 varchar NULL,
  ADD COLUMN IF NOT EXISTS shipping_postal_code varchar NULL,
  ADD COLUMN IF NOT EXISTS profile_synced_at timestamptz NULL;

-- Backfill neutral columns from existing data.
UPDATE accounts
SET
  auth_provider = COALESCE(
    auth_provider,
    CASE
      WHEN "type" = 'KAKAO' THEN 'kakao'
      WHEN "type" = 'NAVER' THEN 'naver'
      WHEN "type" = 'MASTER' THEN 'admin'
      WHEN "type" = 'NORMAL' THEN 'local'
      ELSE NULL
    END
  ),
  auth_subject = COALESCE(auth_subject, "providerUserId"),
  profile_nickname = COALESCE(profile_nickname, kakao_nickname),
  profile_image_url = COALESCE(profile_image_url, kakao_profile_image_url),
  profile_thumbnail_url = COALESCE(profile_thumbnail_url, kakao_thumbnail_image_url),
  shipping_name = COALESCE(shipping_name, kakao_shipping_name),
  shipping_receiver_name = COALESCE(shipping_receiver_name, kakao_shipping_receiver_name),
  shipping_receiver_phone1 = COALESCE(shipping_receiver_phone1, kakao_shipping_receiver_phone1),
  shipping_receiver_phone2 = COALESCE(shipping_receiver_phone2, kakao_shipping_receiver_phone2),
  shipping_postal_code = COALESCE(shipping_postal_code, kakao_shipping_zone_number),
  profile_synced_at = COALESCE(profile_synced_at, kakao_synced_at)
WHERE
  auth_provider IS NULL
  OR auth_subject IS NULL
  OR profile_nickname IS NULL
  OR profile_image_url IS NULL
  OR profile_thumbnail_url IS NULL
  OR shipping_name IS NULL
  OR shipping_receiver_name IS NULL
  OR shipping_receiver_phone1 IS NULL
  OR shipping_receiver_phone2 IS NULL
  OR shipping_postal_code IS NULL
  OR profile_synced_at IS NULL;

-- New index for provider identity lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_auth_provider_subject
  ON accounts (auth_provider, auth_subject)
  WHERE auth_subject IS NOT NULL;

COMMIT;

-- Verify
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
