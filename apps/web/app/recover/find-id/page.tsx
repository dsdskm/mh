"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  fetchSellerPhoneApi,
  findUserIdApi,
  requestRecoverPhoneVerificationApi,
  verifyRecoverPhoneCodeApi,
} from "../api/recover.api";
import { PhoneVerificationBox } from "../../_components/phone-verification-box";

export default function RecoverFindIdPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [foundUserId, setFoundUserId] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);

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
      setSuccess("아이디 찾기용 휴대폰 인증이 완료되었습니다.");
    } catch (verifyError) {
      setVerificationToken(null);
      setPhoneVerified(false);
      setError(verifyError instanceof Error ? verifyError.message : "인증번호 확인 실패");
    } finally {
      setVerifyingCode(false);
    }
  }

  async function submitFindUserId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFinding(true);
    setError(null);
    setSuccess(null);
    setFoundUserId(null);

    if (!verificationToken) {
      setFinding(false);
      setError("아이디 찾기 전 휴대폰 인증을 먼저 완료해주세요.");
      return;
    }

    try {
      const result = await findUserIdApi({
        name: name.trim(),
        phone: phone.replace(/\D/g, ""),
        verificationToken,
      });

      setFoundUserId(result.userId);
      setSuccess("아이디를 찾았습니다.");
    } catch (findError) {
      setError(findError instanceof Error ? findError.message : "아이디 찾기 실패");
    } finally {
      setFinding(false);
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
        <h1 className="font-display text-3xl text-amber-800">아이디 찾기</h1>

        <form className="mt-4 space-y-3 rounded-2xl border border-stone-200 p-4" onSubmit={submitFindUserId}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름"
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
          <button
            type="submit"
            disabled={finding || !phoneVerified}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {finding ? "조회 중..." : "아이디 찾기"}
          </button>
          {foundUserId && (
            <p className="rounded-xl bg-lime-50 p-3 text-sm font-semibold text-lime-800">
              찾은 아이디: {foundUserId}
            </p>
          )}
        </form>

        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p className="mt-3 rounded-xl bg-lime-50 p-3 text-sm text-lime-800">{success}</p>}
      </section>
    </main>
  );
}