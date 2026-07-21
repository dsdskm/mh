"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import kakaoLoginButton from "@repo/ui/assets/kakao_login_medium_narrow.png";

type KakaoSdk = {
  Auth: {
    authorize: (options: { redirectUri: string; state?: string }) => void;
    logout?: (callback?: () => void) => void;
    setAccessToken?: (accessToken: string | null) => void;
  };
  init: (appKey: string) => void;
  isInitialized: () => boolean;
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

const KAKAO_JAVASCRIPT_API_KEY = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_API_KEY?.trim() || "";
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "");

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageFallback() {
  return (
    <main className="min-h-screen bg-corn-pattern text-stone-900">
      <header className="border-b border-amber-200/80 bg-amber-100/80 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <h1 className="text-center font-display text-2xl text-amber-700 sm:text-3xl">옥수수 가게</h1>
        </div>
      </header>
      <div className="px-4 py-12">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-3">
          <button
            type="button"
            disabled
            className="mx-auto block w-full max-w-full overflow-hidden rounded-xl opacity-70"
            style={{ width: kakaoLoginButton.width }}
          >
            <Image src={kakaoLoginButton} alt="카카오로 로그인" className="h-auto w-full" priority />
          </button>

          <p className="text-center text-xs font-semibold text-stone-700">
            최초 카카오 로그인 시 자동으로 회원가입이 진행됩니다.
          </p>

          <div className="w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700">
            <p className="leading-relaxed">
              상품 주문 및 배송 서비스를 위해 이름, 카카오계정(전화번호), 배송지정보를 수집·이용합니다.
            </p>
            <p className="mt-2">로그인 화면을 불러오는 중입니다...</p>
          </div>
        </div>
      </div>
    </main>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const { status } = useSession();
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [shopName, setShopName] = useState("옥수수 가게");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  useEffect(() => {
    let mounted = true;

    async function loadShopName() {
      try {
        const response = await fetch(`${API_BASE}/api/config`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { shopName?: string };
        const nextName = data.shopName?.trim();

        if (mounted && nextName) {
          setShopName(nextName);
        }
      } catch {
        // Keep default title when config cannot be loaded.
      }
    }

    void loadShopName();

    return () => {
      mounted = false;
    };
  }, []);

  function startKakaoLogin() {
    if (loginSubmitting) {
      return;
    }

    setLoginSubmitting(true);
    setLoginError(null);

    const kakao = window.Kakao;
    if (!kakao) {
      setLoginError("카카오 SDK를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      setLoginSubmitting(false);
      return;
    }

    if (!KAKAO_JAVASCRIPT_API_KEY) {
      setLoginError("카카오 JavaScript API 키가 설정되지 않았습니다.");
      setLoginSubmitting(false);
      return;
    }

    if (!kakao.isInitialized()) {
      kakao.init(KAKAO_JAVASCRIPT_API_KEY);
    }

    if (!kakao.isInitialized()) {
      setLoginError("카카오 SDK 초기화에 실패했습니다. 다시 시도해주세요.");
      setLoginSubmitting(false);
      return;
    }

    const startUrl = `/api/auth/kakao/start?callbackUrl=${encodeURIComponent("/")}`;
    window.location.assign(startUrl);
  }

  return (
    <main className="min-h-screen bg-corn-pattern text-stone-900">
      <header className="border-b border-amber-200/80 bg-amber-100/80 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <h1 className="text-center font-display text-2xl text-amber-700 sm:text-3xl">{shopName}</h1>
        </div>
      </header>

      <div className="px-4 py-12">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={startKakaoLogin}
            disabled={loginSubmitting}
            className="mx-auto block w-full max-w-full overflow-hidden rounded-xl disabled:opacity-60"
            style={{ width: kakaoLoginButton.width }}
          >
            <Image src={kakaoLoginButton} alt="카카오로 로그인" className="h-auto w-full" priority />
          </button>

          <p className="text-center text-xs font-semibold text-stone-700">
            최초 카카오 로그인 시 자동으로 회원가입이 진행됩니다.
          </p>

          <div className="w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700">
            <p className="leading-relaxed">
              상품 주문 및 배송 서비스를 위해 이름, 카카오계정(전화번호), 배송지정보를 수집·이용합니다.
            </p>
            <p className="mt-2">자세한 내용은 개인정보처리방침을 확인해주세요.</p>
            <div className="mt-2 flex items-center justify-center gap-3 text-xs font-semibold">
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-stone-700 underline underline-offset-2"
              >
                개인정보처리방침
              </Link>
              <span className="text-stone-300">|</span>
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-stone-700 underline underline-offset-2"
              >
                이용약관
              </Link>
            </div>
          </div>

          {loginError && <p className="w-full rounded-xl bg-red-50 p-3 text-xs text-red-700">{loginError}</p>}
        </div>
      </div>
    </main>
  );
}
