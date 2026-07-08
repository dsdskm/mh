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

export function findUserIdApi(payload: {
  name: string;
  phone: string;
  verificationToken: string;
}): Promise<{ userId: string }> {
  return postJson<{ userId: string }>(
    "/api/auth/find-user-id",
    payload,
    "아이디 찾기에 실패했습니다.",
  );
}

export function resetPasswordApi(payload: {
  userId: string;
  phone: string;
  newPassword: string;
  verificationToken: string;
}): Promise<{ ok: boolean; message: string }> {
  return postJson<{ ok: boolean; message: string }>(
    "/api/auth/reset-password",
    payload,
    "비밀번호 재설정에 실패했습니다.",
  );
}

export function requestRecoverPhoneVerificationApi(payload: {
  phone: string;
}): Promise<{ ok: boolean; expiresAt: string }> {
  return postJson<{ ok: boolean; expiresAt: string }>(
    "/api/auth/phone/request",
    {
      phone: payload.phone,
      purpose: "recover",
    },
    "인증번호 발송에 실패했습니다.",
  );
}

export function verifyRecoverPhoneCodeApi(payload: {
  phone: string;
  code: string;
}): Promise<{ ok: boolean; verificationToken: string; expiresAt: string }> {
  return postJson<{ ok: boolean; verificationToken: string; expiresAt: string }>(
    "/api/auth/phone/verify",
    payload,
    "휴대폰 인증에 실패했습니다.",
  );
}

export async function fetchSellerPhoneApi(): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/api/config`, { cache: "no-store" });
    if (!response.ok) return "";
    const data = (await response.json()) as { sellerPhone?: string };
    return data.sellerPhone?.trim() ?? "";
  } catch {
    return "";
  }
}
