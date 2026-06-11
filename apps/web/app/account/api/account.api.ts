import type {
  SaveShippingAddressPayload,
  ShippingAddressesResponse,
  UpdateProfilePayload,
  UserProfileResponse,
  WithdrawPayload,
} from "../../../types/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002";

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

export function getShippingAddressesApi(userId: string): Promise<ShippingAddressesResponse> {
  return postJson<ShippingAddressesResponse>(
    "/api/auth/shipping-addresses",
    { userId },
    "배송지 목록을 불러오지 못했습니다.",
  );
}

export function saveShippingAddressApi(
  payload: SaveShippingAddressPayload,
): Promise<ShippingAddressesResponse> {
  return postJson<ShippingAddressesResponse>(
    "/api/auth/shipping-addresses/save",
    payload,
    "배송지 저장에 실패했습니다.",
  );
}
