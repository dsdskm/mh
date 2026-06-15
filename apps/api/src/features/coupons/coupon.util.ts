import type { CouponDiscountType } from '@repo/shared-types/coupon';

export type CouponDiscountSpec = {
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
};

// 쿠폰이 만료되었는지 (validUntil 이 지났는지)
export function isCouponExpired(
  validUntil: Date | null,
  now: Date = new Date(),
): boolean {
  return !!validUntil && validUntil.getTime() < now.getTime();
}

// 최소 주문금액 조건을 충족하는지
export function meetsCouponMinOrder(
  coupon: Pick<CouponDiscountSpec, 'minOrderAmount'>,
  baseAmount: number,
): boolean {
  return baseAmount >= (coupon.minOrderAmount ?? 0);
}

// 할인액 계산. baseAmount(상품 소계) 기준. 최소주문금액 미달이면 0.
// 결과는 항상 0 이상이며 baseAmount 를 넘지 않는다.
export function computeCouponDiscount(
  coupon: CouponDiscountSpec,
  baseAmount: number,
): number {
  if (!meetsCouponMinOrder(coupon, baseAmount)) {
    return 0;
  }

  let discount = 0;
  if (coupon.discountType === 'percent') {
    discount = Math.floor((baseAmount * coupon.discountValue) / 100);
    if (coupon.maxDiscountAmount != null) {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }
  } else {
    discount = coupon.discountValue;
  }

  return Math.max(0, Math.min(discount, baseAmount));
}
