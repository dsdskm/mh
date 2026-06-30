"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  findUserIdApi,
  requestRecoverPhoneVerificationApi,
  resetPasswordApi,
  verifyRecoverPhoneCodeApi,
} from "./api/recover.api";

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function RecoverPage() {
  const [name, setName] = useState("");
  const [findPhone, setFindPhone] = useState("");
  const [foundUserId, setFoundUserId] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [findCode, setFindCode] = useState("");
  const [findCodeSent, setFindCodeSent] = useState(false);
  const [findPhoneVerified, setFindPhoneVerified] = useState(false);
  const [findVerificationToken, setFindVerificationToken] = useState<string | null>(null);
  const [findSendingCode, setFindSendingCode] = useState(false);
  const [findVerifyingCode, setFindVerifyingCode] = useState(false);
  const [findCodeExpiresAt, setFindCodeExpiresAt] = useState<number | null>(null);
  const [findCodeRemainingSec, setFindCodeRemainingSec] = useState(0);

  const [resetUserId, setResetUserId] = useState("");
  const [resetPhone, setResetPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetPhoneVerified, setResetPhoneVerified] = useState(false);
  const [resetVerificationToken, setResetVerificationToken] = useState<string | null>(null);
  const [resetSendingCode, setResetSendingCode] = useState(false);
  const [resetVerifyingCode, setResetVerifyingCode] = useState(false);
  const [resetCodeExpiresAt, setResetCodeExpiresAt] = useState<number | null>(null);
  const [resetCodeRemainingSec, setResetCodeRemainingSec] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!findCodeSent || findPhoneVerified || !findCodeExpiresAt) {
      setFindCodeRemainingSec(0);
      return;
    }

    const updateRemaining = () => {
      const nextRemaining = Math.max(
        0,
        Math.ceil((findCodeExpiresAt - Date.now()) / 1000),
      );
      setFindCodeRemainingSec(nextRemaining);

      if (nextRemaining <= 0) {
        setFindCodeSent(false);
        setFindPhoneVerified(false);
        setFindVerificationToken(null);
        setFindCodeExpiresAt(null);
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [findCodeSent, findPhoneVerified, findCodeExpiresAt]);

  useEffect(() => {
    if (!resetCodeSent || resetPhoneVerified || !resetCodeExpiresAt) {
      setResetCodeRemainingSec(0);
      return;
    }

    const updateRemaining = () => {
      const nextRemaining = Math.max(
        0,
        Math.ceil((resetCodeExpiresAt - Date.now()) / 1000),
      );
      setResetCodeRemainingSec(nextRemaining);

      if (nextRemaining <= 0) {
        setResetCodeSent(false);
        setResetPhoneVerified(false);
        setResetVerificationToken(null);
        setResetCodeExpiresAt(null);
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [resetCodeSent, resetPhoneVerified, resetCodeExpiresAt]);

  async function requestFindPhoneCode() {
    const normalizedPhone = findPhone.replace(/\D/g, "");
    if (!normalizedPhone) {
      setError("전화번호를 입력해주세요.");
      return;
    }

    setFindSendingCode(true);
    setError(null);
    setSuccess(null);
    try {
      await requestRecoverPhoneVerificationApi({ phone: normalizedPhone });
      const expiresAtMs = Date.now() + 3 * 60 * 1000;
      setFindCodeSent(true);
      setFindPhoneVerified(false);
      setFindVerificationToken(null);
      setFindCodeExpiresAt(Number.isFinite(expiresAtMs) ? expiresAtMs : null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "인증번호 요청 실패");
    } finally {
      setFindSendingCode(false);
    }
  }

  async function verifyFindPhoneCode() {
    const normalizedPhone = findPhone.replace(/\D/g, "");
    const code = findCode.trim();

    if (!normalizedPhone || !code) {
      setError("전화번호와 인증번호를 입력해주세요.");
      return;
    }

    if (findCodeRemainingSec <= 0) {
      setError("인증번호가 만료되었습니다. 다시 요청해주세요.");
      return;
    }

    setFindVerifyingCode(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await verifyRecoverPhoneCodeApi({
        phone: normalizedPhone,
        code,
      });
      setFindVerificationToken(result.verificationToken);
      setFindPhoneVerified(true);
      setFindCodeRemainingSec(0);
      setSuccess("아이디 찾기용 문자 인증이 완료되었습니다.");
    } catch (verifyError) {
      setFindVerificationToken(null);
      setFindPhoneVerified(false);
      setError(verifyError instanceof Error ? verifyError.message : "인증번호 확인 실패");
    } finally {
      setFindVerifyingCode(false);
    }
  }

  async function requestResetPhoneCode() {
    const normalizedPhone = resetPhone.replace(/\D/g, "");
    if (!normalizedPhone) {
      setError("전화번호를 입력해주세요.");
      return;
    }

    setResetSendingCode(true);
    setError(null);
    setSuccess(null);
    try {
      await requestRecoverPhoneVerificationApi({ phone: normalizedPhone });
      const expiresAtMs = Date.now() + 3 * 60 * 1000;
      setResetCodeSent(true);
      setResetPhoneVerified(false);
      setResetVerificationToken(null);
      setResetCodeExpiresAt(Number.isFinite(expiresAtMs) ? expiresAtMs : null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "인증번호 요청 실패");
    } finally {
      setResetSendingCode(false);
    }
  }

  async function verifyResetPhoneCode() {
    const normalizedPhone = resetPhone.replace(/\D/g, "");
    const code = resetCode.trim();

    if (!normalizedPhone || !code) {
      setError("전화번호와 인증번호를 입력해주세요.");
      return;
    }

    if (resetCodeRemainingSec <= 0) {
      setError("인증번호가 만료되었습니다. 다시 요청해주세요.");
      return;
    }

    setResetVerifyingCode(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await verifyRecoverPhoneCodeApi({
        phone: normalizedPhone,
        code,
      });
      setResetVerificationToken(result.verificationToken);
      setResetPhoneVerified(true);
      setResetCodeRemainingSec(0);
      setSuccess("비밀번호 재설정용 문자 인증이 완료되었습니다.");
    } catch (verifyError) {
      setResetVerificationToken(null);
      setResetPhoneVerified(false);
      setError(verifyError instanceof Error ? verifyError.message : "인증번호 확인 실패");
    } finally {
      setResetVerifyingCode(false);
    }
  }

  async function submitFindUserId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFinding(true);
    setError(null);
    setSuccess(null);
    setFoundUserId(null);

    if (!findVerificationToken) {
      setFinding(false);
      setError("아이디 찾기 전 문자 인증을 먼저 완료해주세요.");
      return;
    }

    try {
      const result = await findUserIdApi({
        name: name.trim(),
        phone: findPhone.replace(/\D/g, ""),
        verificationToken: findVerificationToken,
      });

      setFoundUserId(result.userId);
      setSuccess("아이디를 찾았습니다.");
      setResetUserId(result.userId);
      setResetPhone(findPhone.replace(/\D/g, ""));
    } catch (findError) {
      setError(findError instanceof Error ? findError.message : "아이디 찾기 실패");
    } finally {
      setFinding(false);
    }
  }

  async function submitResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetting(true);
    setError(null);
    setSuccess(null);

    if (!resetVerificationToken) {
      setResetting(false);
      setError("비밀번호 재설정 전 문자 인증을 먼저 완료해주세요.");
      return;
    }

    try {
      const result = await resetPasswordApi({
        userId: resetUserId.trim(),
        phone: resetPhone.replace(/\D/g, ""),
        newPassword,
        verificationToken: resetVerificationToken,
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
      <Link href="/" className="text-sm font-semibold text-amber-700">
        ← 홈으로
      </Link>

      <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow">
        <h1 className="font-display text-3xl text-amber-800">아이디/비밀번호 찾기</h1>

        <div className="mt-4 space-y-6">
          <form className="space-y-3 rounded-2xl border border-stone-200 p-4" onSubmit={submitFindUserId}>
            <p className="text-sm font-bold text-stone-800">아이디 찾기</p>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="이름"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              required
            />
            <input
              value={findPhone}
              onChange={(event) => {
                setFindPhone(event.target.value.replace(/\D/g, ""));
                setFindCodeSent(false);
                setFindPhoneVerified(false);
                setFindVerificationToken(null);
                setFindCodeExpiresAt(null);
                setFindCodeRemainingSec(0);
              }}
              placeholder="전화번호 (숫자만 입력)"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              inputMode="numeric"
              required
            />
            <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-semibold text-stone-600">휴대폰 문자 인증</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void requestFindPhoneCode()}
                  disabled={findSendingCode}
                  className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-700 disabled:opacity-60"
                >
                  {findSendingCode ? "요청 중..." : "인증번호 받기"}
                </button>
                <input
                  value={findCode}
                  onChange={(event) => setFindCode(event.target.value)}
                  placeholder="인증번호"
                  className="w-32 rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void verifyFindPhoneCode()}
                  disabled={findVerifyingCode || !findCodeSent || findCodeRemainingSec <= 0}
                  className="rounded-xl bg-lime-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  {findVerifyingCode ? "확인 중..." : "확인"}
                </button>
              </div>
              {findCodeSent && !findPhoneVerified && (
                <p className={`text-xs font-semibold ${findCodeRemainingSec > 0 ? "text-amber-700" : "text-red-600"}`}>
                  인증번호 유효시간: {formatCountdown(findCodeRemainingSec)}
                </p>
              )}
              <p className={`text-xs font-semibold ${findPhoneVerified ? "text-lime-700" : "text-stone-500"}`}>
                {findPhoneVerified ? "문자 인증 완료" : "문자 인증 필요"}
              </p>
            </div>
            <button
              type="submit"
              disabled={finding || !findPhoneVerified}
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

          <form className="space-y-3 rounded-2xl border border-stone-200 p-4" onSubmit={submitResetPassword}>
            <p className="text-sm font-bold text-stone-800">비밀번호 재설정</p>
            <input
              value={resetUserId}
              onChange={(event) => setResetUserId(event.target.value)}
              placeholder="아이디"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              required
            />
            <input
              value={resetPhone}
              onChange={(event) => {
                setResetPhone(event.target.value.replace(/\D/g, ""));
                setResetCodeSent(false);
                setResetPhoneVerified(false);
                setResetVerificationToken(null);
                setResetCodeExpiresAt(null);
                setResetCodeRemainingSec(0);
              }}
              placeholder="전화번호 (숫자만 입력)"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              inputMode="numeric"
              required
            />
            <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-semibold text-stone-600">휴대폰 문자 인증</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void requestResetPhoneCode()}
                  disabled={resetSendingCode}
                  className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-700 disabled:opacity-60"
                >
                  {resetSendingCode ? "요청 중..." : "인증번호 받기"}
                </button>
                <input
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value)}
                  placeholder="인증번호"
                  className="w-32 rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void verifyResetPhoneCode()}
                  disabled={resetVerifyingCode || !resetCodeSent || resetCodeRemainingSec <= 0}
                  className="rounded-xl bg-lime-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  {resetVerifyingCode ? "확인 중..." : "확인"}
                </button>
              </div>
              {resetCodeSent && !resetPhoneVerified && (
                <p className={`text-xs font-semibold ${resetCodeRemainingSec > 0 ? "text-amber-700" : "text-red-600"}`}>
                  인증번호 유효시간: {formatCountdown(resetCodeRemainingSec)}
                </p>
              )}
              <p className={`text-xs font-semibold ${resetPhoneVerified ? "text-lime-700" : "text-stone-500"}`}>
                {resetPhoneVerified ? "문자 인증 완료" : "문자 인증 필요"}
              </p>
            </div>
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
              disabled={resetting || !resetPhoneVerified}
              className="w-full rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {resetting ? "처리 중..." : "비밀번호 재설정"}
            </button>
          </form>
        </div>

        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p className="mt-3 rounded-xl bg-lime-50 p-3 text-sm text-lime-800">{success}</p>}
      </section>
    </main>
  );
}
