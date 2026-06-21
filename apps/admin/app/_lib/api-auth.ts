import { API_BASE } from "./constants";
import { parseJsonOrThrow } from "./api-common";

type AdminLoginResponse = {
  ok: boolean;
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: number;
  expiresIn: number;
};

export async function loginAdminApi(userId: string, password: string): Promise<AdminLoginResponse> {
  const response = await fetch(`${API_BASE}/api/backoffice/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, password }),
  });

  return parseJsonOrThrow<AdminLoginResponse>(response, "아이디 또는 비밀번호를 확인해주세요.");
}

export async function checkAdminUserIdApi(
  userId: string,
): Promise<{ available: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/auth/check-user-id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  return parseJsonOrThrow<{ available: boolean; message: string }>(
    response,
    "아이디 중복확인에 실패했습니다.",
  );
}

export async function checkAdminPhoneApi(
  phone: string,
): Promise<{ available: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/auth/check-phone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  return parseJsonOrThrow<{ available: boolean; message: string }>(
    response,
    "전화번호 중복확인에 실패했습니다.",
  );
}
