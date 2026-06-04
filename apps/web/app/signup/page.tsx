"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CheckUserIdResponse,
  RequestPhoneVerificationResponse,
  SignupResponse,
  VerifyPhoneCodeResponse,
} from "../../types/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002";
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

export default function SignupPage() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [checkingUserId, setCheckingUserId] = useState(false);
  const [isUserIdAvailable, setIsUserIdAvailable] = useState<boolean | null>(null);
  const [userIdMessage, setUserIdMessage] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [postcodeReady, setPostcodeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const normalizedPhone = useMemo(() => phone.replace(/\D/g, ""), [phone]);
  const passwordChecks = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasLetter: /[a-zA-Z]/.test(password),
      hasDigit: /\d/.test(password),
      hasSpecial: /[^a-zA-Z0-9]/.test(password),
      matches: password.length > 0 && password === passwordConfirm,
    };
  }, [password, passwordConfirm]);

  const passwordPolicySatisfied =
    passwordChecks.minLength &&
    passwordChecks.hasLetter &&
    passwordChecks.hasDigit &&
    passwordChecks.hasSpecial;

  const combinedAddress = useMemo(() => {
    const base = address.trim();
    const detail = addressDetail.trim();

    if (!base) {
      return detail;
    }

    if (!detail) {
      return base;
    }

    return `${base} ${detail}`;
  }, [address, addressDetail]);

  useEffect(() => {
    if (window.daum?.Postcode) {
      setPostcodeReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = DAUM_POSTCODE_SCRIPT_URL;
    script.async = true;
    script.onload = () => setPostcodeReady(true);
    script.onerror = () => {
      setError("주소 검색 스크립트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    };

    document.head.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
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

        setAddress(`${baseAddress}${buildingSuffix}`.trim());
        setError(null);
        setSuccess("주소를 불러왔습니다. 필요하면 상세주소를 추가 입력해주세요.");
      },
    }).open();
  }

  async function checkUserId() {
    const normalizedUserId = userId.trim().toLowerCase();
    if (!normalizedUserId) {
      setError("아이디를 입력해주세요.");
      return;
    }

    setCheckingUserId(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE}/api/auth/check-user-id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: normalizedUserId,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "아이디 중복확인에 실패했습니다.");
      }

      const data = (await response.json()) as CheckUserIdResponse;
      setIsUserIdAvailable(data.available);
      setUserIdMessage(data.message);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "아이디 중복확인 실패");
      setIsUserIdAvailable(null);
      setUserIdMessage(null);
    } finally {
      setCheckingUserId(false);
    }
  }

  async function requestSmsCode() {
    setSendingCode(true);
    setError(null);
    setSuccess(null);
    setVerificationToken(null);

    try {
      const response = await fetch(`${API_BASE}/api/auth/phone/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: normalizedPhone,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "인증번호 발송에 실패했습니다.");
      }

      const data = (await response.json()) as RequestPhoneVerificationResponse;
      setCodeSent(true);
      setDevCodeHint(data.devCode ?? null);
      setSuccess("인증번호를 전송했습니다. 휴대폰 문자를 확인해주세요.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "인증번호 발송 실패");
    } finally {
      setSendingCode(false);
    }
  }

  async function verifySmsCode() {
    setVerifyingCode(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE}/api/auth/phone/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          code: smsCode.trim(),
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "휴대폰 인증에 실패했습니다.");
      }

      const data = (await response.json()) as VerifyPhoneCodeResponse;
      setVerificationToken(data.verificationToken);
      setSuccess("전화번호 인증이 완료되었습니다.");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "인증번호 확인 실패");
    } finally {
      setVerifyingCode(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== passwordConfirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (isUserIdAvailable !== true) {
      setError("아이디 중복확인을 완료해주세요.");
      return;
    }

    if (!passwordPolicySatisfied) {
      setError("비밀번호는 영문+숫자+특수문자 포함 8자 이상이어야 합니다.");
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
      const response = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId.trim(),
          password,
          name: name.trim(),
          phone: normalizedPhone,
          address: combinedAddress,
          verificationToken,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "회원가입에 실패했습니다.");
      }

      const result = (await response.json()) as SignupResponse;
      setSuccess(`${result.account.name}님, 회원가입이 완료되었습니다. 이제 일반 로그인 기능을 연결하면 바로 사용할 수 있어요.`);
      setPassword("");
      setPasswordConfirm("");
      setSmsCode("");
      setVerificationToken(null);
      setCodeSent(false);
      setDevCodeHint(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "회원가입 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-4 py-6">
      <Link href="/" className="text-sm font-semibold text-amber-700">
        ← 홈으로
      </Link>

      <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow">
        <h1 className="font-display text-3xl text-amber-800">회원가입</h1>
        <p className="mt-1 text-sm text-stone-600">아이디/비밀번호 기반 일반 회원가입입니다. 전화번호는 문자 인증 후 가입됩니다.</p>

        <form className="mt-4 space-y-3" onSubmit={submit}>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
                setIsUserIdAvailable(null);
                setUserIdMessage(null);
              }}
              placeholder="아이디 (영문 소문자/숫자 4~20자)"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              autoComplete="username"
              required
            />
            <button
              type="button"
              onClick={() => void checkUserId()}
              disabled={checkingUserId || !userId.trim()}
              className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-60"
            >
              {checkingUserId ? "확인 중..." : "중복확인"}
            </button>
          </div>
          {userIdMessage && (
            <p
              className={`rounded-xl p-3 text-xs ${
                isUserIdAvailable ? "bg-lime-50 text-lime-800" : "bg-amber-50 text-amber-900"
              }`}
            >
              {userIdMessage}
            </p>
          )}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호 (영문+숫자+특수문자 포함 8자 이상)"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            placeholder="비밀번호 확인"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            autoComplete="new-password"
            required
          />
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs">
            <p className="mb-2 font-semibold text-stone-700">비밀번호 조건</p>
            <ul className="space-y-1">
              <li className={passwordChecks.minLength ? "text-lime-700" : "text-stone-600"}>
                {passwordChecks.minLength ? "✓" : "-"} 8자 이상
              </li>
              <li className={passwordChecks.hasLetter ? "text-lime-700" : "text-stone-600"}>
                {passwordChecks.hasLetter ? "✓" : "-"} 영문 포함
              </li>
              <li className={passwordChecks.hasDigit ? "text-lime-700" : "text-stone-600"}>
                {passwordChecks.hasDigit ? "✓" : "-"} 숫자 포함
              </li>
              <li className={passwordChecks.hasSpecial ? "text-lime-700" : "text-stone-600"}>
                {passwordChecks.hasSpecial ? "✓" : "-"} 특수문자 포함
              </li>
              <li
                className={
                  passwordConfirm.length === 0
                    ? "text-stone-600"
                    : passwordChecks.matches
                      ? "text-lime-700"
                      : "text-red-600"
                }
              >
                {passwordConfirm.length === 0 ? "-" : passwordChecks.matches ? "✓" : "!"} 비밀번호 확인 일치
              </li>
            </ul>
          </div>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름(닉네임)"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            autoComplete="name"
            required
          />

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setVerificationToken(null);
              }}
              placeholder="전화번호 (숫자만)"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              autoComplete="tel"
              required
            />
            <button
              type="button"
              onClick={() => void requestSmsCode()}
              disabled={sendingCode || !normalizedPhone}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {sendingCode ? "발송 중..." : "인증번호 받기"}
            </button>
          </div>

          {codeSent && (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={smsCode}
                onChange={(event) => setSmsCode(event.target.value)}
                placeholder="문자로 받은 6자리 인증번호"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                required
              />
              <button
                type="button"
                onClick={() => void verifySmsCode()}
                disabled={verifyingCode || !smsCode.trim()}
                className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-60"
              >
                {verifyingCode ? "확인 중..." : "인증 확인"}
              </button>
            </div>
          )}

          {devCodeHint && (
            <p className="rounded-xl bg-stone-100 p-3 text-xs text-stone-700">
              개발환경 테스트용 인증번호: {devCodeHint}
            </p>
          )}

          {verificationToken && (
            <p className="rounded-xl bg-lime-50 p-3 text-sm text-lime-800">전화번호 인증 완료</p>
          )}

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="주소 검색 또는 직접 입력"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              autoComplete="street-address"
              required
            />
            <button
              type="button"
              onClick={searchAddress}
              disabled={!postcodeReady}
              className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-60"
            >
              {postcodeReady ? "주소 검색" : "로딩 중..."}
            </button>
          </div>

          <input
            value={addressDetail}
            onChange={(event) => setAddressDetail(event.target.value)}
            placeholder="상세 주소 (동/호수 등)"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            autoComplete="address-line2"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? "가입 처리 중..." : "가입 신청"}
          </button>
        </form>

        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p className="mt-3 rounded-xl bg-lime-50 p-3 text-sm text-lime-800">{success}</p>}
      </section>
    </main>
  );
}
