import type {
  UpdateProfilePayload,
  UserProfileResponse,
  WithdrawPayload,
} from "../../../types/auth";
import type { Coupon } from "@repo/shared-types/coupon";
import type { MileageSummary } from "@repo/shared-types/mileage";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "");

type ApiErrorBody = {
  message?: string;
};

async function postJson<TResponse>(
  path: string,
  payload: unknown,
  fallbackMessage: string,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.message ?? fallbackMessage);
  }

  return (await response.json()) as TResponse;
}

export function getProfileApi(userId: string): Promise<UserProfileResponse> {
  return postJson<UserProfileResponse>("/api/auth/profile", { userId }, "회원 정보를 불러오지 못했습니다.");
}

export function updateProfileApi(payload: UpdateProfilePayload): Promise<UserProfileResponse> {
  return postJson<UserProfileResponse>("/api/auth/profile/update", payload, "정보수정에 실패했습니다.");
}

export function withdrawApi(payload: WithdrawPayload): Promise<{ ok: boolean; message: string }> {
  return postJson<{ ok: boolean; message: string }>("/api/auth/withdraw", payload, "탈퇴 처리에 실패했습니다.");
}

async function getJson<TResponse>(
  path: string,
  fallbackMessage: string,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.message ?? fallbackMessage);
  }
  return (await response.json()) as TResponse;
}

export function getMyCouponsApi(accountId: number): Promise<Coupon[]> {
  return getJson<Coupon[]>(
    `/api/coupons?accountId=${accountId}`,
    "쿠폰을 불러오지 못했습니다.",
  );
}

export function getMyMileageApi(accountId: number): Promise<MileageSummary> {
  return getJson<MileageSummary>(
    `/api/mileage?accountId=${accountId}`,
    "적립금을 불러오지 못했습니다.",
  );
}
