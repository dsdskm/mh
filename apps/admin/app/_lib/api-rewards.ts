import { API_BASE } from "./constants";
import { parseJsonOrThrow } from "./api-common";
import type { Coupon, IssueCouponInput, MileageSummary } from "./types";

export async function listCouponsApi(): Promise<Coupon[]> {
  const response = await fetch(`${API_BASE}/api/backoffice/coupons`, {
    cache: "no-store",
  });
  return parseJsonOrThrow<Coupon[]>(response, "쿠폰 목록을 불러오지 못했습니다.");
}

export async function issueCouponApi(
  input: IssueCouponInput,
): Promise<{ issued: number }> {
  const response = await fetch(`${API_BASE}/api/backoffice/coupons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow<{ issued: number }>(response, "쿠폰 지급에 실패했습니다.");
}

export async function revokeCouponApi(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/api/backoffice/coupons/${id}`, {
    method: "DELETE",
  });
  await parseJsonOrThrow<{ ok: boolean }>(response, "쿠폰 회수에 실패했습니다.");
}

export async function getAccountMileageApi(
  accountId: number,
): Promise<MileageSummary> {
  const response = await fetch(
    `${API_BASE}/api/backoffice/accounts/${accountId}/mileage`,
    { cache: "no-store" },
  );
  return parseJsonOrThrow<MileageSummary>(
    response,
    "적립금 정보를 불러오지 못했습니다.",
  );
}

export async function adjustAccountMileageApi(
  accountId: number,
  amount: number,
  reason?: string,
): Promise<MileageSummary> {
  const response = await fetch(
    `${API_BASE}/api/backoffice/accounts/${accountId}/mileage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, reason }),
    },
  );
  return parseJsonOrThrow<MileageSummary>(response, "적립금 조정에 실패했습니다.");
}
