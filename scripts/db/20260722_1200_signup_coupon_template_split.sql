-- 신규가입 쿠폰 유형 분리 + 재가입 쿠폰 재발급 방지 이력 테이블

ROLLBACK;

ALTER TABLE coupon_templates
  ADD COLUMN IF NOT EXISTS usage varchar NOT NULL DEFAULT 'general';

CREATE TABLE IF NOT EXISTS signup_coupon_claims (
  id serial PRIMARY KEY,
  account_id int NULL,
  phone varchar NULL,
  provider_user_id varchar NULL,
  template_name varchar NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_signup_coupon_claims_account_id
  ON signup_coupon_claims (account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_signup_coupon_claims_phone
  ON signup_coupon_claims (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_signup_coupon_claims_provider_user_id
  ON signup_coupon_claims (provider_user_id)
  WHERE provider_user_id IS NOT NULL;

-- 운영자가 기존 가입쿠폰 템플릿을 지정해둔 경우, 해당 템플릿은 신규가입 전용으로 승격합니다.
UPDATE coupon_templates
SET usage = 'signup'
WHERE id IN (
  SELECT "signupCouponTemplateId"
  FROM app_settings
  WHERE "signupCouponTemplateId" IS NOT NULL
);

-- Verify #1: 템플릿 유형 분리 확인
SELECT id, name, usage, "createdAt"
FROM coupon_templates
ORDER BY id DESC;

-- Verify #2: 재가입 차단 이력 확인
SELECT id, account_id, phone, provider_user_id, template_name, claimed_at
FROM signup_coupon_claims
ORDER BY id DESC;
