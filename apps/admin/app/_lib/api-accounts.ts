import { API_BASE } from "./constants";
import { parseJsonOrThrow } from "./api-common";
import { AdminUser, AdminUserCreatePayload, AdminUserUpdatePayload } from "./types";

export type AdminShippingAddress = {
  id: number;
  name: string;
  address1: string;
  address2: string;
  isDefault: boolean;
};

export async function createAdminAccountApi(
  payload: AdminUserCreatePayload,
): Promise<AdminUser> {
  const response = await fetch(`${API_BASE}/api/backoffice/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<AdminUser>(response, "계정 생성에 실패했습니다.");
}

export async function updateAdminAccountApi(
  id: number,
  payload: AdminUserUpdatePayload,
): Promise<AdminUser> {
  const response = await fetch(`${API_BASE}/api/backoffice/accounts/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<AdminUser>(response, "계정 수정에 실패했습니다.");
}

export async function deleteAdminAccountApi(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/api/backoffice/accounts/${id}`, {
    method: "DELETE",
  });

  await parseJsonOrThrow<{ ok: boolean }>(response, "계정 삭제에 실패했습니다.");
}

export async function getAdminAccountShippingAddressesApi(
  accountId: number,
): Promise<AdminShippingAddress[]> {
  const response = await fetch(`${API_BASE}/api/backoffice/accounts/${accountId}/shipping-addresses`, {
    cache: "no-store",
  });

  const data = await parseJsonOrThrow<{ shippingAddresses: AdminShippingAddress[] }>(
    response,
    "배송지 목록을 불러오지 못했습니다.",
  );

  return data.shippingAddresses;
}
