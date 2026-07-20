"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import type { DaumPostcodeData, DaumPostcodeWindow } from "../../../../types/daum-postcode";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "");
const DAUM_POSTCODE_SCRIPT_URL =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

declare global {
  interface Window {
    daum?: DaumPostcodeWindow;
  }
}

function normalizeCallbackUrl(rawValue: string | null): string {
  const trimmed = rawValue?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }
  return trimmed;
}

function KakaoWelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(
    () => normalizeCallbackUrl(searchParams.get("callbackUrl")),
    [searchParams],
  );
  const { data: session, status } = useSession();

  const [postalCode, setPostalCode] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [postcodeReady, setPostcodeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userId = session?.user?.email?.trim() ?? "";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [router, status]);

  useEffect(() => {
    if (window.daum?.Postcode) {
      setPostcodeReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = DAUM_POSTCODE_SCRIPT_URL;
    script.async = true;
    script.onload = () => setPostcodeReady(true);

    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, []);

  function searchAddress() {
    if (!window.daum?.Postcode) {
      setError("주소 검색 준비 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data) => {
        const baseAddress = data.roadAddress || data.jibunAddress;
        const buildingSuffix =
          data.apartment === "Y" && data.buildingName
            ? ` (${data.buildingName})`
            : "";

        setPostalCode(data.zonecode?.trim() ?? "");
        setAddress1(`${baseAddress}${buildingSuffix}`.trim());
        setError(null);
      },
    }).open();
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setError("로그인 정보를 확인할 수 없습니다.");
      return;
    }

    if (!postalCode.trim() || !address1.trim()) {
      setError("우편번호와 주소를 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE}/api/auth/kakao/complete-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          postalCode: postalCode.trim(),
          address1: address1.trim(),
          address2: address2.trim(),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "추가정보 저장에 실패했습니다.");
      }

      const body = (await response.json()) as {
        profile?: {
          id?: number;
          userId?: string;
          accountType?: string;
          name?: string;
          phone?: string;
          address1?: string;
          address2?: string;
        };
      };

      console.info("[kakao:welcome] complete-profile response", {
        userId,
        profile: body.profile,
      });

      router.replace(callbackUrl);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "추가정보 저장 실패");
    } finally {
      setSubmitting(false);
    }
  }

  if (status !== "authenticated") {
    return <main className="mx-auto max-w-md px-4 py-10 text-sm text-stone-600">확인 중...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 py-10">
      <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm">
        <h1 className="font-display text-2xl text-amber-800 sm:text-3xl">추가 정보 입력</h1>
        <p className="mt-1 text-sm text-stone-600">
          카카오 회원가입을 완료하려면 배송에 필요한 정보를 입력해주세요.
        </p>

        <form className="mt-4 space-y-3" onSubmit={submitProfile}>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={postalCode}
              readOnly
              placeholder="우편번호"
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-500"
              required
            />
            <button
              type="button"
              onClick={searchAddress}
              disabled={!postcodeReady}
              className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-60 sm:whitespace-nowrap"
            >
              {postcodeReady ? "주소 검색" : "로딩 중..."}
            </button>
          </div>

          <div>
            <input
              value={address1}
              placeholder="주소검색 클릭"
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-500"
              readOnly
              required
            />
          </div>

          <input
            value={address2}
            onChange={(event) => setAddress2(event.target.value)}
            placeholder="상세 주소"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? "저장 중..." : "완료"}
          </button>

          <button
            type="button"
            onClick={() => router.replace(callbackUrl)}
            disabled={submitting}
            className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-700 disabled:opacity-60"
          >
            건너뛰기
          </button>
        </form>

        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p className="mt-3 rounded-xl bg-lime-50 p-3 text-sm text-lime-800">{success}</p>}
      </section>
    </main>
  );
}

export default function KakaoWelcomePage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-10 text-sm text-stone-600">확인 중...</main>}>
      <KakaoWelcomeContent />
    </Suspense>
  );
}
