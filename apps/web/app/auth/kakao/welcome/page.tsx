"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { requestPhoneVerificationApi, verifyPhoneCodeApi } from "../../../signup/api/singup.api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "");
const DAUM_POSTCODE_SCRIPT_URL =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

type DaumPostcodeData = {
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  apartment: "Y" | "N";
};

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
      }) => {
        open: () => void;
      };
    };
  }
}

function normalizeCallbackUrl(rawValue: string | null): string {
  const trimmed = rawValue?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }
  return trimmed;
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function KakaoWelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(
    () => normalizeCallbackUrl(searchParams.get("callbackUrl")),
    [searchParams],
  );
  const { data: session, status } = useSession();

  const [name, setName] = useState(session?.user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [codeRemainingSec, setCodeRemainingSec] = useState(0);
  const [postcodeReady, setPostcodeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userId = session?.user?.email?.trim() ?? "";
  const normalizedPhone = useMemo(() => phone.replace(/\D/g, ""), [phone]);

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

  useEffect(() => {
    if (!codeSent || verificationToken || !codeExpiresAt) {
      setCodeRemainingSec(0);
      return;
    }

    const updateRemaining = () => {
      const nextRemaining = Math.max(
        0,
        Math.ceil((codeExpiresAt - Date.now()) / 1000),
      );
      setCodeRemainingSec(nextRemaining);

      if (nextRemaining <= 0) {
        setCodeSent(false);
        setVerificationToken(null);
        setCodeExpiresAt(null);
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [codeSent, verificationToken, codeExpiresAt]);

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

        setAddress1(`${baseAddress}${buildingSuffix}`.trim());
        setError(null);
      },
    }).open();
  }

  async function requestSmsCode() {
    if (!normalizedPhone) {
      setError("전화번호를 입력해주세요.");
      return;
    }

    setSendingCode(true);
    setError(null);
    setSuccess(null);
    setVerificationToken(null);

    try {
      await requestPhoneVerificationApi(normalizedPhone);
      const expiresAtMs = Date.now() + 3 * 60 * 1000;
      setCodeSent(true);
      setCodeExpiresAt(expiresAtMs);
      setSuccess("인증번호를 전송했습니다.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "인증번호 발송 실패");
    } finally {
      setSendingCode(false);
    }
  }

  async function verifySmsCode() {
    if (codeRemainingSec <= 0) {
      setError("인증번호가 만료되었습니다. 다시 요청해주세요.");
      return;
    }

    setVerifyingCode(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await verifyPhoneCodeApi({
        phone: normalizedPhone,
        code: smsCode.trim(),
      });
      setVerificationToken(data.verificationToken);
      setCodeRemainingSec(0);
      setSuccess("전화번호 인증이 완료되었습니다.");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "인증번호 확인 실패");
    } finally {
      setVerifyingCode(false);
    }
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setError("로그인 정보를 확인할 수 없습니다.");
      return;
    }

    if (!verificationToken) {
      setError("전화번호 인증을 완료해주세요.");
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
          name: name.trim(),
          phone: normalizedPhone,
          address1: address1.trim(),
          address2: address2.trim(),
          verificationToken,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "추가정보 저장에 실패했습니다.");
      }

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
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={phone}
              onChange={(event) => {
                const digitsOnly = event.target.value.replace(/\D/g, "");
                setPhone(digitsOnly);
                setVerificationToken(null);
                setCodeSent(false);
                setSmsCode("");
                setCodeExpiresAt(null);
                setCodeRemainingSec(0);
              }}
              placeholder="전화번호 (숫자만 입력)"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              inputMode="numeric"
              required
            />
            <button
              type="button"
              onClick={() => void requestSmsCode()}
              disabled={sendingCode || !normalizedPhone}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60 sm:whitespace-nowrap"
            >
              {sendingCode ? "발송 중..." : "인증번호 받기"}
            </button>
          </div>

          {codeSent && (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={smsCode}
                onChange={(event) => setSmsCode(event.target.value)}
                placeholder="받은 6자리 인증번호"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                required
              />
              <button
                type="button"
                onClick={() => void verifySmsCode()}
                disabled={verifyingCode || !smsCode.trim() || codeRemainingSec <= 0}
                className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-60"
              >
                {verifyingCode ? "확인 중..." : "인증 확인"}
              </button>
            </div>
          )}

          {codeSent && !verificationToken && (
            <p className={`rounded-xl p-3 text-xs font-semibold ${codeRemainingSec > 0 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>
              인증번호 유효시간: {formatCountdown(codeRemainingSec)}
            </p>
          )}

          {verificationToken && (
            <p className="rounded-xl bg-lime-50 p-3 text-sm text-lime-800">전화번호 인증 완료</p>
          )}

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={address1}
              placeholder="주소검색 클릭"
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-500"
              readOnly
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
