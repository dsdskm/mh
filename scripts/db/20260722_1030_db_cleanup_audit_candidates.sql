-- Global DB cleanup audit (read-only): use this before dropping tables/columns.
-- 1) Check row count and size by table.
-- 2) Check FK references to avoid dropping in-use tables.
-- 3) Check low-use nullable columns in accounts.

-- 1) Table row count + size (public schema)
SELECT
  t.tablename AS table_name,
  pg_total_relation_size(format('%I.%I', t.schemaname, t.tablename)) AS total_bytes,
  pg_size_pretty(pg_total_relation_size(format('%I.%I', t.schemaname, t.tablename))) AS total_size,
  c.reltuples::bigint AS estimated_rows
FROM pg_tables t
JOIN pg_class c
  ON c.relname = t.tablename
JOIN pg_namespace n
  ON n.oid = c.relnamespace
 AND n.nspname = t.schemaname
WHERE t.schemaname = 'public'
ORDER BY total_bytes DESC;

-- 2) FK reference map (what depends on what)
SELECT
  conrelid::regclass AS source_table,
  confrelid::regclass AS target_table,
  conname AS fk_name
FROM pg_constraint
WHERE contype = 'f'
ORDER BY conrelid::regclass::text, confrelid::regclass::text;

-- 3) accounts nullable-column fill ratio (for legacy candidate detection)
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE "email" IS NOT NULL AND btrim("email") <> '') AS email_filled,
  COUNT(*) FILTER (WHERE "address1" IS NOT NULL AND btrim("address1") <> '') AS address1_filled,
  COUNT(*) FILTER (WHERE "address2" IS NOT NULL AND btrim("address2") <> '') AS address2_filled,
  COUNT(*) FILTER (WHERE "password" IS NOT NULL AND btrim("password") <> '') AS password_filled,
  COUNT(*) FILTER (WHERE "phoneVerifiedAt" IS NOT NULL) AS phone_verified_at_filled,
  COUNT(*) FILTER (WHERE "termsAgreedAt" IS NOT NULL) AS terms_agreed_at_filled
FROM accounts;

-- 4) accounts <-> accounts_kakao 매핑 점검
SELECT
  (SELECT COUNT(*) FROM accounts WHERE "type" = 'KAKAO') AS kakao_accounts,
  (SELECT COUNT(*) FROM accounts_kakao) AS accounts_kakao_rows,
  (SELECT COUNT(*)
   FROM accounts a
   LEFT JOIN accounts_kakao ak ON ak.account_id = a.id
   WHERE a."type" = 'KAKAO' AND ak.id IS NULL) AS missing_kakao_profile_rows;

-- 5) Optional template to drop an unused table safely (replace <table_name>)
-- BEGIN;
--   DROP TABLE IF EXISTS <table_name> CASCADE;
-- COMMIT;
