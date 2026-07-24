"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "");

function KakaoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const code = searchParams.get("code");
  const kakaoError = searchParams.get("error");
  const kakaoErrorDescription = searchParams.get("error_description");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [supportPhone, setSupportPhone] = useState("");
  const [supportKakaoChannelUrl, setSupportKakaoChannelUrl] = useState("");
  const shouldShowSupportContact =
    !!errorMessage && errorMessage.includes("비활성화된 계정입니다");

  useEffect(() => {
    if (!shouldShowSupportContact) {
      return;
    }

    let cancelled = false;

    async function loadSupportContact() {
      try {
        const response = await fetch(`${API_BASE}/api/config`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          sellerPhone?: string;
          kakaoChannelUrl?: string;
        };

        if (cancelled) {
          return;
        }

        setSupportPhone(data.sellerPhone?.trim() ?? "");
        setSupportKakaoChannelUrl(data.kakaoChannelUrl?.trim() ?? "");
      } catch {
        // ignore
      }
    }

    void loadSupportContact();

    return () => {
      cancelled = true;
    };
  }, [shouldShowSupportContact]);

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

      console.info("[kakao:callback] signIn result", {
        ok: result?.ok,
        error: result?.error,
        status: result?.status,
        url: result?.url,
      });

      if (cancelled) {
        return;
      }

      if (result?.error) {
        setErrorMessage(result.error);
        return;
      }

      const sessionInfo = await resolveSessionInfo();
      console.info("[kakao:callback] resolved session userId", {
        userId: sessionInfo?.userId,
        signupWelcomePopup: sessionInfo?.signupWelcomePopup,
      });

      if (sessionInfo?.userId) {
        const profileState = await getKakaoProfileState(sessionInfo.userId);
        const needOnboarding = profileState.needOnboarding;
        console.info("[kakao:callback] profile onboarding check", {
          userId: sessionInfo.userId,
          needOnboarding,
        });
        if (needOnboarding) {
          window.location.replace(`/auth/kakao/welcome?callbackUrl=${encodeURIComponent("/")}`);
          return;
        }
      }

      window.location.replace("/");
    }

    async function resolveSessionInfo(): Promise<{ userId: string | null; signupWelcomePopup: boolean } | null> {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as {
            user?: { email?: string; signupWelcomePopup?: boolean };
          };
          const email = data.user?.email?.trim() ?? null;
          if (email) {
            console.info("[kakao:callback] session fetch success", {
              email,
              signupWelcomePopup: data.user?.signupWelcomePopup === true,
              attempt,
            });
            return {
              userId: email,
              signupWelcomePopup: data.user?.signupWelcomePopup === true,
            };
          }
        }

        console.info("[kakao:callback] session fetch retry", {
          attempt,
          ok: response.ok,
        });

        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }

      return null;
    }

    async function getKakaoProfileState(userId: string): Promise<{
      needOnboarding: boolean;
    }> {
      const response = await fetch(`${API_BASE}/api/auth/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        console.info("[kakao:callback] profile fetch failed", {
          userId,
          status: response.status,
        });
        return {
          needOnboarding: false,
        };
      }

      const data = (await response.json()) as {
        profile?: {
          accountType?: string;
          createdAt?: string;
          address1?: string;
          kakaoShippingZoneNumber?: string;
        };
      };

      const profile = data.profile;
      console.info("[kakao:callback] profile response", {
        userId,
        profile,
      });
      if (!profile || profile.accountType !== "KAKAO") {
        return {
          needOnboarding: false,
        };
      }

      return {
        needOnboarding: !profile.address1?.trim() || !profile.kakaoShippingZoneNumber?.trim(),
      };
    }

    void runLogin();

    return () => {
      cancelled = true;
    };
  }, [code, kakaoError, kakaoErrorDescription, router]);

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
            {shouldShowSupportContact && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
                <p className="font-semibold">고객센터 문의</p>
                <p className="mt-1">
                  판매자 연락처: {supportPhone || "확인 중"}
                </p>
                <p className="mt-1 break-all">
                  카카오 채널 문의 URL: {supportKakaoChannelUrl ? (
                    <a
                      href={supportKakaoChannelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline"
                    >
                      {supportKakaoChannelUrl}
                    </a>
                  ) : (
                    "확인 중"
                  )}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => router.replace("/")}
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
