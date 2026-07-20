import type {
  RequestPhoneVerificationResponse,
  VerifyPhoneCodePayload,
  VerifyPhoneCodeResponse,
} from "../../../types/auth";

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

export function requestPhoneVerificationApi(
  phone: string,
): Promise<RequestPhoneVerificationResponse> {
  return postJson<RequestPhoneVerificationResponse>(
    "/api/auth/phone/request",
    { phone },
    "인증번호 발송에 실패했습니다.",
  );
}

export function verifyPhoneCodeApi(
  payload: VerifyPhoneCodePayload,
): Promise<VerifyPhoneCodeResponse> {
  return postJson<VerifyPhoneCodeResponse>(
    "/api/auth/phone/verify",
    payload,
    "휴대폰 인증에 실패했습니다.",
  );
}