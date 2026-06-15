export type CouponDiscountType = "fixed" | "percent";

export type CouponStatus = "available" | "used" | "revoked";

export type Coupon = {
  id: number;
  accountId: number;
  name: string;
  discountType: CouponDiscountType;
  // discountType 이 'fixed' 면 할인 원, 'percent' 면 할인 퍼센트(%)
  discountValue: number;
  minOrderAmount: number;
  // 정률 할인 상한 (없으면 null)
  maxDiscountAmount: number | null;
  // 유효기한 ISO 문자열 (없으면 null = 무기한)
  validUntil: string | null;
  status: CouponStatus;
  usedOrderId: number | null;
  usedAt: string | null;
  issuedAt: string;
  // 조회 응답에 포함될 수 있는 파생 필드: 보유 계정 표시용 이름 / 만료 여부
  accountName?: string | null;
  expired?: boolean;
};

export type IssueCouponInput = {
  // 특정 회원 id 목록 또는 전체 회원("all")
  accountIds: number[] | "all";
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number | null;
  validUntil?: string | null;
};
