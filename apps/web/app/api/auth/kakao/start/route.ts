import { NextRequest, NextResponse } from "next/server";

type KakaoLoginState = {
  callbackUrl: string;
};

function normalizeCallbackUrl(rawValue: string | null): string {
  const trimmed = rawValue?.trim();
  if (!trimmed || !trimmed.startsWith("/")) {
    return "/";
  }

  if (trimmed.startsWith("//")) {
    return "/";
  }

  return trimmed;
}

export async function GET(request: NextRequest) {
  const clientId =
    process.env.KAKAO_REST_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY?.trim() ||
    process.env.KAKAO_CLIENT_ID?.trim() ||
    "";

  if (!clientId) {
    return NextResponse.json(
      {
        message: "카카오 로그인 설정이 누락되었습니다.",
      },
      { status: 500 },
    );
  }

  const callbackUrl = normalizeCallbackUrl(
    request.nextUrl.searchParams.get("callbackUrl"),
  );

  const redirectUri =
    process.env.KAKAO_REDIRECT_URI?.trim() ||
    `${request.nextUrl.origin}/auth/kakao/callback`;
  const stateValue: KakaoLoginState = { callbackUrl };
  const state = Buffer.from(JSON.stringify(stateValue), "utf8").toString("base64url");

  const maskedClientId =
    clientId.length > 8
      ? `${clientId.slice(0, 4)}...${clientId.slice(-4)}`
      : clientId;
  console.info("[auth:kakao:start] authorize request", {
    origin: request.nextUrl.origin,
    redirectUri,
    clientId: maskedClientId,
  });

  const authUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
