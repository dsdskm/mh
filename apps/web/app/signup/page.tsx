"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import {
  checkPhoneApi,
  checkUserIdApi,
  requestPhoneVerificationApi,
  signupApi,
  verifyPhoneCodeApi,
} from "./api/singup.api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "");
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
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [checkingUserId, setCheckingUserId] = useState(false);
  const [isUserIdAvailable, setIsUserIdAvailable] = useState<boolean | null>(null);
  const [userIdMessage, setUserIdMessage] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [isPhoneAvailable, setIsPhoneAvailable] = useState<boolean | null>(null);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [termsUrl, setTermsUrl] = useState<string>("");
  const [privacyUrl, setPrivacyUrl] = useState<string>("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [postcodeReady, setPostcodeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [signupCouponNotice, setSignupCouponNotice] = useState<string | null>(null);

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

  useEffect(() => {
    async function loadPolicyUrls() {
      try {
        const response = await fetch(`${API_BASE}/api/config`, {
          cache: "no-store",
        });

        if (!response.ok) {
          setTermsUrl("");
          setPrivacyUrl("");
          return;
        }

        const data = (await response.json()) as {
          termsUrl?: string;
          privacyUrl?: string;
        };
        setTermsUrl(data.termsUrl?.trim() ?? "");
        setPrivacyUrl(data.privacyUrl?.trim() ?? "");
      } catch {
        setTermsUrl("");
        setPrivacyUrl("");
      }
    }

    void loadPolicyUrls();
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

        setAddress1(`${baseAddress}${buildingSuffix}`.trim());
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
      const data = await checkUserIdApi(normalizedUserId);
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
    if (!normalizedPhone) {
      setError("전화번호를 입력해주세요.");
      return;
    }

    setSendingCode(true);
    setError(null);
    setSuccess(null);
    setVerificationToken(null);

    try {
      const checkData = await checkPhoneApi(normalizedPhone);
      setIsPhoneAvailable(checkData.available);
      setPhoneMessage(checkData.message);

      if (!checkData.available) {
        return;
      }

      const data = await requestPhoneVerificationApi(normalizedPhone);
      setCodeSent(true);
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
      const data = await verifyPhoneCodeApi({
        phone: normalizedPhone,
        code: smsCode.trim(),
      });
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

    if (isPhoneAvailable !== true) {
      setError("전화번호 중복확인을 완료해주세요.");
      return;
    }

    if (!termsAgreed) {
      setError("회원가입을 위해 약관 및 개인정보처리방침에 동의해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await signupApi({
        userId: userId.trim(),
        password,
        name: name.trim(),
        phone: normalizedPhone,
        address1: address1.trim(),
        address2: address2.trim(),
        termsAgreed,
        verificationToken,
      });
      setRegistered(true);
      if (result.signupCoupon.issued) {
        setSignupCouponNotice(
          result.signupCoupon.name
            ? `${result.signupCoupon.name}이 발급되었습니다.`
            : "신규 가입 쿠폰이 발급되었습니다.",
        );
      } else {
        setSignupCouponNotice(null);
      }

      // Keep submitting state until auto-login and redirect complete.
      const loginResult = await signIn("credentials", {
        userId: userId.trim(),
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        throw new Error(loginResult.error);
      }

      setPassword("");
      setPasswordConfirm("");
      setSmsCode("");
      setVerificationToken(null);
      setCodeSent(false);
      setTermsAgreed(false);
      setIsPhoneAvailable(null);
      setPhoneMessage(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "회원가입 실패");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-3 px-3 py-4 sm:px-4 sm:py-6">
      <Link href="/" className="text-sm font-semibold text-amber-700">
        ← 홈으로
      </Link>

      <section className="rounded-3xl border border-amber-200 bg-white p-4 shadow sm:p-5">
        <h1 className="font-display text-3xl text-amber-800">회원가입</h1>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          아이디/비밀번호 기반 일반 회원가입입니다. 전화번호는 문자 인증 후 가입됩니다.
        </p>

        <form className="mt-4 space-y-3" onSubmit={submit}>
          <div className="grid gap-2 grid-cols-[1fr_auto]">
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
              className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-60 whitespace-nowrap"
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

          <div className="grid gap-2 grid-cols-[1fr_auto]">
            <input
              value={phone}
              onChange={(event) => {
                const digitsOnly = event.target.value.replace(/\D/g, "");
                setPhone(digitsOnly);
                setIsPhoneAvailable(null);
                setPhoneMessage(null);
                setVerificationToken(null);
                setCodeSent(false);
                setSmsCode("");
              }}
              placeholder="전화번호 (숫자만)"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              autoComplete="tel"
              inputMode="numeric"
              required
            />
            <button
              type="button"
              onClick={() => void requestSmsCode()}
              disabled={sendingCode || !normalizedPhone}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60 whitespace-nowrap"
            >
              {sendingCode ? "발송 중..." : "인증번호 받기"}
            </button>
          </div>

          {phoneMessage && (
            <p
              className={`rounded-xl p-3 text-xs ${
                isPhoneAvailable ? "bg-lime-50 text-lime-800" : "bg-amber-50 text-amber-900"
              }`}
            >
              {phoneMessage}
            </p>
          )}

          {codeSent && (
            <div className="grid gap-2 grid-cols-[1fr_auto]">
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
                className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-60 whitespace-nowrap"
              >
                {verifyingCode ? "확인 중..." : "인증 확인"}
              </button>
            </div>
          )}

          {verificationToken && (
            <p className="rounded-xl bg-lime-50 p-3 text-sm text-lime-800">전화번호 인증 완료</p>
          )}

          <div className="grid gap-2 grid-cols-[1fr_auto]">
            <input
              value={address1}
              placeholder="주소검색 클릭"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm bg-stone-50 text-stone-500"
              autoComplete="street-address"
              readOnly
              required
            />
            <button
              type="button"
              onClick={searchAddress}
              disabled={!postcodeReady}
              className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-60 whitespace-nowrap"
            >
              {postcodeReady ? "주소 검색" : "로딩 중..."}
            </button>
          </div>

          <input
            value={address2}
            onChange={(event) => setAddress2(event.target.value)}
            placeholder="상세 주소 (동/호수 등)"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            autoComplete="address-line2"
            required
          />

          {termsUrl && (
            <div className="rounded-xl border border-stone-200 bg-white p-2 sm:p-3">
              <p className="px-2 pb-2 text-xs font-semibold text-stone-700">이용약관 (필수)</p>
              <iframe
                src={termsUrl}
                title="이용약관"
                className="h-[26rem] w-full rounded-lg border border-stone-200 sm:h-72"
              />
            </div>
          )}

          {privacyUrl && (
            <div className="rounded-xl border border-stone-200 bg-white p-2 sm:p-3">
              <p className="px-2 pb-2 text-xs font-semibold text-stone-700">개인정보처리방침 (필수)</p>
              <iframe
                src={privacyUrl}
                title="개인정보처리방침"
                className="h-[26rem] w-full rounded-lg border border-stone-200 sm:h-72"
              />
            </div>
          )}

          <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-stone-700">
            <input
              type="checkbox"
              checked={termsAgreed}
              onChange={(event) => setTermsAgreed(event.target.checked)}
              className="mt-0.5 h-6 w-6 rounded"
              required
            />
            <span>
              위 내용을 확인했으며 <strong>(필수) 이용약관 및 개인정보처리방침</strong>에 동의합니다.
            </span>
          </label>

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
      {registered && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lime-100 text-2xl text-lime-700">
              ✓
            </div>
            <p className="mt-3 text-base font-bold text-stone-900">가입이 완료되었습니다</p>
            <p className="mt-1 text-sm text-stone-600">자동으로 로그인되었습니다.</p>
            {signupCouponNotice && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                {signupCouponNotice}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setRegistered(false);
                router.push("/");
              }}
              className="mt-4 w-full rounded-xl bg-lime-600 px-3 py-2 text-sm font-bold text-white"
            >
              홈으로 이동
            </button>
          </div>
        </div>
      )}    </main>
  );
}
