-- Add Kakao-related profile/shipping columns to accounts.
-- Safe to run multiple times.

BEGIN;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS kakao_nickname varchar NULL,
  ADD COLUMN IF NOT EXISTS kakao_profile_image_url varchar NULL,
  ADD COLUMN IF NOT EXISTS kakao_thumbnail_image_url varchar NULL,
  ADD COLUMN IF NOT EXISTS kakao_shipping_name varchar NULL,
  ADD COLUMN IF NOT EXISTS kakao_shipping_receiver_name varchar NULL,
  ADD COLUMN IF NOT EXISTS kakao_shipping_receiver_phone1 varchar NULL,
  ADD COLUMN IF NOT EXISTS kakao_shipping_receiver_phone2 varchar NULL,
  ADD COLUMN IF NOT EXISTS kakao_shipping_zone_number varchar NULL,
  ADD COLUMN IF NOT EXISTS kakao_synced_at timestamptz NULL;

COMMIT;

-- Verify
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts'
  AND column_name IN (
    'kakao_nickname',
    'kakao_profile_image_url',
    'kakao_thumbnail_image_url',
    'kakao_shipping_name',
    'kakao_shipping_receiver_name',
    'kakao_shipping_receiver_phone1',
    'kakao_shipping_receiver_phone2',
    'kakao_shipping_zone_number',
    'kakao_synced_at'
  )
ORDER BY column_name;
