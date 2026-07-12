"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  fetchSellerPhoneApi,
  requestRecoverPhoneVerificationApi,
  resetPasswordApi,
  verifyRecoverPhoneCodeApi,
} from "../api/recover.api";
import { PhoneVerificationBox } from "../../_components/phone-verification-box";

export default function RecoverResetPasswordPage() {
  const [userId, setUserId] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [codeRemainingSec, setCodeRemainingSec] = useState(0);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [sellerPhone, setSellerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSellerPhoneApi().then((phoneNumber) => setSellerPhone(phoneNumber)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!codeSent || phoneVerified || !codeExpiresAt) {
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
        setPhoneVerified(false);
        setVerificationToken(null);
        setCodeExpiresAt(null);
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [codeSent, phoneVerified, codeExpiresAt]);

  async function requestPhoneCode() {
    const normalizedPhone = phone.replace(/\D/g, "");
    if (!normalizedPhone) {
      setError("전화번호를 입력해주세요.");
      return;
    }

    setSendingCode(true);
    setPhoneError(null);
    setError(null);
    setSuccess(null);
    try {
      await requestRecoverPhoneVerificationApi({ phone: normalizedPhone });
      const expiresAtMs = Date.now() + 3 * 60 * 1000;
      setCodeSent(true);
      setPhoneVerified(false);
      setVerificationToken(null);
      setCodeExpiresAt(Number.isFinite(expiresAtMs) ? expiresAtMs : null);
    } catch (requestError) {
      setPhoneError(requestError instanceof Error ? requestError.message : "인증번호 요청 실패");
    } finally {
      setSendingCode(false);
    }
  }

  async function verifyPhoneCode() {
    const normalizedPhone = phone.replace(/\D/g, "");
    const trimmedCode = code.trim();

    if (!normalizedPhone || !trimmedCode) {
      setError("전화번호와 인증번호를 입력해주세요.");
      return;
    }

    if (codeRemainingSec <= 0) {
      setError("인증번호가 만료되었습니다. 다시 요청해주세요.");
      return;
    }

    setVerifyingCode(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await verifyRecoverPhoneCodeApi({
        phone: normalizedPhone,
        code: trimmedCode,
      });
      setVerificationToken(result.verificationToken);
      setPhoneVerified(true);
      setCodeRemainingSec(0);
      setSuccess("비밀번호 재설정용 휴대폰 인증이 완료되었습니다.");
    } catch (verifyError) {
      setVerificationToken(null);
      setPhoneVerified(false);
      setError(verifyError instanceof Error ? verifyError.message : "인증번호 확인 실패");
    } finally {
      setVerifyingCode(false);
    }
  }

  async function submitResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetting(true);
    setError(null);
    setSuccess(null);

    if (!verificationToken) {
      setResetting(false);
      setError("비밀번호 재설정 전 휴대폰 인증을 먼저 완료해주세요.");
      return;
    }

    try {
      const result = await resetPasswordApi({
        userId: userId.trim(),
        phone: phone.replace(/\D/g, ""),
        newPassword,
        verificationToken,
      });

      setSuccess(result.message);
      setNewPassword("");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "비밀번호 재설정 실패");
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-center gap-3 text-sm font-semibold">
        <Link href="/" className="text-amber-700">
          ← 홈으로
        </Link>
        <Link href="/recover" className="text-stone-500">
          계정 찾기
        </Link>
      </div>

      <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow">
        <h1 className="font-display text-3xl text-amber-800">비밀번호 찾기</h1>

        <form className="mt-4 space-y-3 rounded-2xl border border-stone-200 p-4" onSubmit={submitResetPassword}>
          <input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="아이디"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <input
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value.replace(/\D/g, ""));
              setCodeSent(false);
              setPhoneVerified(false);
              setVerificationToken(null);
              setCodeExpiresAt(null);
              setCodeRemainingSec(0);
            }}
            placeholder="전화번호 (숫자만 입력)"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            inputMode="numeric"
            required
          />
          <PhoneVerificationBox
            code={code}
            onCodeChange={setCode}
            codeSent={codeSent}
            verified={phoneVerified}
            remainingSec={codeRemainingSec}
            sending={sendingCode}
            verifying={verifyingCode}
            onSend={() => { void requestPhoneCode(); }}
            onVerify={() => { void verifyPhoneCode(); }}
            error={phoneError}
            sellerPhone={sellerPhone}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="새 비밀번호"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={resetting || !phoneVerified}
            className="w-full rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {resetting ? "처리 중..." : "비밀번호 재설정"}
          </button>
        </form>

        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p className="mt-3 rounded-xl bg-lime-50 p-3 text-sm text-lime-800">{success}</p>}
      </section>
    </main>
  );
}