"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "");

type KakaoStatePayload = {
  callbackUrl?: string;
};

function normalizeCallbackUrl(rawValue: string | undefined): string {
  if (!rawValue || !rawValue.startsWith("/") || rawValue.startsWith("//")) {
    return "/";
  }

  return rawValue;
}

function decodeState(stateParam: string | null): string {
  if (!stateParam) {
    return "/";
  }

  try {
    const padded = stateParam + "=".repeat((4 - (stateParam.length % 4)) % 4);
    const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64);
    const payload = JSON.parse(decoded) as KakaoStatePayload;
    return normalizeCallbackUrl(payload.callbackUrl);
  } catch {
    return "/";
  }
}

function KakaoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const code = searchParams.get("code");
  const kakaoError = searchParams.get("error");
  const kakaoErrorDescription = searchParams.get("error_description");
  const callbackUrl = useMemo(() => decodeState(searchParams.get("state")), [searchParams]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function runLogin() {
      if (kakaoError) {
        setErrorMessage(kakaoErrorDescription || "카카오 로그인에 실패했습니다.");
        return;
      }

      if (!code) {
        setErrorMessage("카카오 인증 코드가 없어 로그인을 완료할 수 없습니다.");
        return;
      }

      const redirectUri = `${window.location.origin}/auth/kakao/callback`;
      const result = await signIn("kakao-rest", {
        code,
        redirectUri,
        redirect: false,
      });

      if (cancelled) {
        return;
      }

      if (result?.error) {
        setErrorMessage(result.error);
        return;
      }

      const userId = await resolveSessionUserId();
      if (userId) {
        const needOnboarding = await hasIncompleteKakaoProfile(userId);
        if (needOnboarding) {
          router.replace(`/auth/kakao/welcome?callbackUrl=${encodeURIComponent(callbackUrl)}`);
          return;
        }
      }

      router.replace(callbackUrl);
    }

    async function resolveSessionUserId(): Promise<string | null> {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as { user?: { email?: string } };
          const email = data.user?.email?.trim();
          if (email) {
            return email;
          }
        }

        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }

      return null;
    }

    async function hasIncompleteKakaoProfile(userId: string): Promise<boolean> {
      const response = await fetch(`${API_BASE}/api/auth/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as {
        profile?: {
          accountType?: string;
          name?: string;
          phone?: string;
          address1?: string;
        };
      };

      const profile = data.profile;
      if (!profile || profile.accountType !== "KAKAO") {
        return false;
      }

      return !profile.name?.trim() || !profile.phone?.trim() || !profile.address1?.trim();
    }

    void runLogin();

    return () => {
      cancelled = true;
    };
  }, [callbackUrl, code, kakaoError, kakaoErrorDescription, router]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md items-center justify-center px-4 py-10">
      <div className="w-full rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
        {!errorMessage && (
          <>
            <h1 className="font-display text-2xl text-amber-800">카카오 로그인 처리 중</h1>
            <p className="mt-2 text-sm text-stone-600">잠시만 기다려주세요.</p>
          </>
        )}

        {errorMessage && (
          <>
            <h1 className="font-display text-2xl text-amber-800">카카오 로그인 실패</h1>
            <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
            <button
              type="button"
              onClick={() => router.replace(callbackUrl)}
              className="mt-4 w-full rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700"
            >
              돌아가기
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function KakaoCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[60vh] w-full max-w-md items-center justify-center px-4 py-10">
          <div className="w-full rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
            <h1 className="font-display text-2xl text-amber-800">카카오 로그인 처리 중</h1>
            <p className="mt-2 text-sm text-stone-600">잠시만 기다려주세요.</p>
          </div>
        </main>
      }
    >
      <KakaoCallbackContent />
    </Suspense>
  );
}
