#!/usr/bin/env sh
# ---------------------------------------------------------------------------
# Mock 데이터 시드 스크립트
#   - 상품: 옥수수 2종 ([MOCK] 마커)
#   - 사용자(NORMAL) 30명 + 사용자별 기본 배송지
#   - 사용자별 회원 주문 1건 + 비회원(guest) 주문 6건
#   - 사용자별 문의 1~2건, 후기 1~2건
#   - 일부 문의/후기에 관리자 답글
#
# 기본정보(app_settings)는 만들거나 수정하지 않습니다.
#
# 모든 데이터에 식별 마커가 붙어 있어 dev-mock-clean.sh 로 정확히 제거됩니다.
#   상품:        products.name LIKE '[MOCK]%'
#   사용자:      accounts.userId LIKE 'mockuser%' (type=NORMAL)
#   주문:        orders.id 가 2000010100000 ~ 2000010299999 범위 (날짜 2000-01-01/02 기반)
#   문의/후기/답글: id LIKE 'MOCK-%'
#
# mock 사용자 로그인 정보:  아이디 mockuser01 ~ mockuser30 / 비밀번호 1234
# ---------------------------------------------------------------------------
set -eu

DATABASE_URL="${DATABASE_URL:-postgresql://root:root@localhost:5432/main}"

echo "[mock-seed] DATABASE_URL=$DATABASE_URL"
echo "[mock-seed] mock 데이터를 생성합니다..."

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- 현재 상태까지의 단계별 상태 이력(JSONB)을 생성하는 세션 임시 함수
--   forward: received → paid → preparing → shipping → delivered
--   취소: received → cancel_requested / cancel_completed
--   각 단계는 주문 생성시각 기준 6시간 간격으로 누적
CREATE OR REPLACE FUNCTION pg_temp.mock_status_history(p_status TEXT, p_created TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql AS $fn$
DECLARE
  v_flow   TEXT[] := ARRAY['received','paid','preparing','shipping','delivered'];
  v_steps  TEXT[];
  v_idx    INT;
  v_result JSONB := '[]'::jsonb;
  v_ts     TIMESTAMPTZ;
  k        INT;
BEGIN
  IF p_status = 'cancel_requested' THEN
    v_steps := ARRAY['received','cancel_requested'];
  ELSIF p_status = 'cancel_completed' THEN
    v_steps := ARRAY['received','cancel_completed'];
  ELSE
    v_idx := array_position(v_flow, p_status);
    IF v_idx IS NULL THEN
      v_steps := ARRAY['received'];
    ELSE
      v_steps := v_flow[1:v_idx];
    END IF;
  END IF;

  FOR k IN 1 .. array_length(v_steps, 1) LOOP
    v_ts := p_created + ((k - 1) * interval '6 hours');
    v_result := v_result || jsonb_build_object(
      'status', v_steps[k],
      'at', to_char(v_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    );
  END LOOP;

  RETURN v_result;
END;
$fn$;

DO $$
DECLARE
  -- 모든 mock 사용자가 공유하는 비밀번호 '1234' 의 scrypt 해시 (salt:key)
  c_password   TEXT := 'fbb121f9bc388a4f58e760077857bfa7:793c25c9d3d8b61eaab7cefbc88e008af836216380b71405c44d8fb8eb22e5567752bbcb0f3a40f02fb5339292c318999b2900f43a6410efe2d2fa6c35b432e4';

  c_names      TEXT[] := ARRAY[
    '김민준','이서연','박도윤','최지우','정하준','강서윤','조예준','윤지호','장하은','임수아',
    '한지안','오은우','서다은','신예은','권시우','황주원','안유진','송지민','전건우','홍서아',
    '문준서','양하린','배지율','백지호','유채원','남도현','심예나','노은성','하지원','곽시현'
  ];
  c_guests     TEXT[] := ARRAY['김손님','이방문','박둘러','최구경','정살까','한처음'];
  c_statuses   TEXT[] := ARRAY['received','paid','preparing','shipping','delivered','cancel_requested'];

  v_prod_ids   INT[];
  v_prod_cnt   INT;

  v_user_id    INT;
  v_uid        TEXT;
  v_name       TEXT;
  v_phone      TEXT;
  v_addr1      TEXT;
  v_addr2      TEXT;

  v_pid        INT;
  v_pname      TEXT;
  v_price      INT;
  v_qty        INT;
  v_sub        INT;

  v_order_id   BIGINT;
  v_status     TEXT;
  v_created    TIMESTAMPTZ;

  v_inq_cnt    INT;
  v_rev_cnt    INT;

  i            INT;
  j            INT;
BEGIN
  -- 0) 상품: 옥수수 2종 --------------------------------------------------
  WITH ins AS (
    INSERT INTO products ("name","description","price","stock","totalQuantity","imageUrl","badge","active","createdAt","updatedAt")
    VALUES
      ('[MOCK] 해남 찰옥수수 10개', '쫄깃하고 고소한 해남산 찰옥수수. 삶아서 바로 즐기세요.', 15000, 200, 0, 'https://picsum.photos/seed/waxycorn/600',  'BEST', true, now(), now()),
      ('[MOCK] 괴산 초당옥수수 10개', '생으로도 달콤한 괴산 초당옥수수. 아삭한 식감이 일품입니다.', 19000, 150, 0, 'https://picsum.photos/seed/sweetcorn/600', 'NEW',  true, now(), now())
    RETURNING id
  )
  SELECT array_agg(id ORDER BY id) INTO v_prod_ids FROM ins;
  v_prod_cnt := array_length(v_prod_ids, 1);

  -- 1) 사용자 30명 + 배송지 + 주문 + 문의 + 후기 -------------------------
  FOR i IN 1..30 LOOP
    v_uid   := 'mockuser' || lpad(i::text, 2, '0');
    v_name  := c_names[i];
    v_phone := '010-' || lpad((1000 + i)::text, 4, '0') || '-' || lpad(i::text, 4, '0');
    v_addr1 := '서울특별시 강남구 테헤란로 ' || (i * 7) || '길 ' || i;
    v_addr2 := lpad(i::text, 3, '0') || '호';

    INSERT INTO accounts
      ("userId","username","type","password","email","displayName","phone","address1","address2",
       "status","isActive","termsAgreed","termsAgreedAt","createdAt","updatedAt")
    VALUES
      (v_uid, v_uid, 'NORMAL', c_password, v_uid || '@example.com', v_name, v_phone, v_addr1, v_addr2,
       'active', true, true, now() - ((30 - i) || ' days')::interval, now() - ((30 - i) || ' days')::interval, now())
    RETURNING id INTO v_user_id;

    INSERT INTO account_shipping_addresses
      ("accountId","name","address1","address2","isDefault","createdAt","updatedAt")
    VALUES
      (v_user_id, '기본 배송지', v_addr1, v_addr2, true, now(), now());

    -- 회원 주문 1건 (옥수수 2종을 순환 참조)
    v_pid := v_prod_ids[1 + (i % v_prod_cnt)];
    SELECT name, price INTO v_pname, v_price FROM products WHERE id = v_pid;

    v_qty      := 1 + (i % 3);
    v_sub      := v_price * v_qty;
    -- 회원 mock 주문번호: 2000-01-01 기반 (2000010100001 ~ 2000010100030)
    v_order_id := 2000010100000 + i;
    v_status   := c_statuses[1 + (i % array_length(c_statuses, 1))];
    -- 최근 약 5개월(0~149일) 범위로 날짜를 흩뿌려 캘린더에서 다양하게 보이도록 함
    v_created  := now() - (((i * 13) % 150) || ' days')::interval - (((i * 7) % 24) || ' hours')::interval;

    INSERT INTO orders
      ("id","accountId","customerName","phone","shippingAddress","requestNote","depositorName",
       "purchaseType","status","cancelReason","totalAmount","createdAt","statusHistory")
    VALUES
      (v_order_id, v_user_id, v_name, v_phone, v_addr1 || ' ' || v_addr2,
       CASE WHEN i % 4 = 0 THEN '부재 시 문 앞에 놓아주세요.' ELSE NULL END,
       v_name, 'member', v_status,
       CASE WHEN v_status = 'cancel_requested' THEN '단순 변심' ELSE NULL END,
       v_sub, v_created,
       pg_temp.mock_status_history(v_status, v_created));

    INSERT INTO order_items ("orderId","productId","productName","unitPrice","quantity","subtotal")
    VALUES (v_order_id, v_pid, v_pname, v_price, v_qty, v_sub);

    -- 문의 1~2건
    v_inq_cnt := 1 + (i % 2);
    FOR j IN 1..v_inq_cnt LOOP
      INSERT INTO inquiries ("id","name","phone","title","message","createdAt","updatedAt")
      VALUES
        ('MOCK-INQ-' || i || '-' || j, v_name, v_phone,
         '배송 관련 문의드립니다 (' || j || ')',
         v_name || '입니다. 주문한 옥수수 배송 일정이 궁금합니다. 확인 부탁드려요.',
         now() - ((i + j) || ' hours')::interval, now());

      -- 일부 문의에 관리자 답글
      IF i % 3 = 0 THEN
        INSERT INTO inquiry_comments ("id","inquiryId","name","content","createdAt")
        VALUES
          ('MOCK-IQC-' || i || '-' || j, 'MOCK-INQ-' || i || '-' || j, '관리자',
           '안녕하세요, 문의 주셔서 감사합니다. 주문하신 상품은 영업일 기준 2~3일 내 발송됩니다.',
           now() - ((i + j) || ' hours' )::interval + interval '1 hour');
      END IF;
    END LOOP;

    -- 후기 1~2건
    v_rev_cnt := 1 + ((i + 1) % 2);
    FOR j IN 1..v_rev_cnt LOOP
      INSERT INTO reviews ("id","name","content","createdAt","updatedAt")
      VALUES
        ('MOCK-REV-' || i || '-' || j, v_name,
         '옥수수가 정말 달고 쫄깃해요! 재구매 의사 있습니다. (후기 ' || j || ')',
         now() - ((i + j) || ' hours')::interval, now());

      -- 일부 후기에 관리자 답글
      IF i % 4 = 0 THEN
        INSERT INTO review_comments ("id","reviewId","name","content","createdAt")
        VALUES
          ('MOCK-RVC-' || i || '-' || j, 'MOCK-REV-' || i || '-' || j, '관리자',
           '소중한 후기 감사합니다! 앞으로도 좋은 상품으로 보답하겠습니다.',
           now() - ((i + j) || ' hours')::interval + interval '2 hours');
      END IF;
    END LOOP;
  END LOOP;

  -- 2) 비회원(guest) 주문 6건 --------------------------------------------
  FOR i IN 1..6 LOOP
    v_pid := v_prod_ids[1 + (i % v_prod_cnt)];
    SELECT name, price INTO v_pname, v_price FROM products WHERE id = v_pid;

    v_name     := c_guests[i];
    v_phone    := '010-' || lpad((2000 + i)::text, 4, '0') || '-' || lpad((9000 + i)::text, 4, '0');
    v_qty      := 1 + (i % 2);
    v_sub      := v_price * v_qty;
    -- 비회원 mock 주문번호: 2000-01-02 기반 (2000010200001 ~ 2000010200006)
    v_order_id := 2000010200000 + i;
    v_status   := c_statuses[1 + (i % array_length(c_statuses, 1))];
    -- 비회원 주문도 최근 약 3개월 범위로 흩뿌림
    v_created  := now() - (((i * 17) % 90) || ' days')::interval - (((i * 5) % 24) || ' hours')::interval;

    INSERT INTO orders
      ("id","accountId","customerName","phone","shippingAddress","requestNote","depositorName",
       "purchaseType","status","cancelReason","totalAmount","createdAt","statusHistory")
    VALUES
      (v_order_id, NULL, v_name, v_phone, '경기도 성남시 분당구 불정로 ' || (i * 11), NULL,
       v_name, 'guest', v_status, NULL, v_sub, v_created,
       pg_temp.mock_status_history(v_status, v_created));

    INSERT INTO order_items ("orderId","productId","productName","unitPrice","quantity","subtotal")
    VALUES (v_order_id, v_pid, v_pname, v_price, v_qty, v_sub);
  END LOOP;
END $$;

-- 생성 결과 요약 (기본정보는 원본 그대로이므로 집계 제외)
SELECT '상품'   AS 항목, count(*) AS 건수 FROM products            WHERE name LIKE '[MOCK]%'
UNION ALL SELECT '사용자',  count(*) FROM accounts                 WHERE "userId" LIKE 'mockuser%'
UNION ALL SELECT '배송지',  count(*) FROM account_shipping_addresses WHERE "accountId" IN (SELECT id FROM accounts WHERE "userId" LIKE 'mockuser%')
UNION ALL SELECT '주문',    count(*) FROM orders                   WHERE id >= 2000010100000 AND id < 2000010300000
UNION ALL SELECT '주문항목', count(*) FROM order_items             WHERE "orderId" >= 2000010100000 AND "orderId" < 2000010300000
UNION ALL SELECT '문의',    count(*) FROM inquiries                WHERE id LIKE 'MOCK-INQ-%'
UNION ALL SELECT '문의답글', count(*) FROM inquiry_comments        WHERE id LIKE 'MOCK-IQC-%'
UNION ALL SELECT '후기',    count(*) FROM reviews                  WHERE id LIKE 'MOCK-REV-%'
UNION ALL SELECT '후기답글', count(*) FROM review_comments         WHERE id LIKE 'MOCK-RVC-%';
SQL

echo "[mock-seed] 완료. (로그인: mockuser01~30 / 1234)"
