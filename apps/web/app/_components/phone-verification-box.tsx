"use client";

import type { ReactNode } from "react";
import { formatPhone } from "../_lib/format";

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

type PhoneContactMessageProps = {
  sellerPhone?: string;
};

export function PhoneContactMessage({ sellerPhone }: PhoneContactMessageProps) {
  return (
    <p className="text-xs text-stone-500">
      시간이 지나도 인증 알림이 오지 않는 경우 서비스 운영자에게 연락해주세요.
      {sellerPhone && (
        <>
          <br />
          <a href={`tel:${sellerPhone}`} className="font-semibold text-amber-700">
            {formatPhone(sellerPhone)}
          </a>
        </>
      )}
    </p>
  );
}

type PhoneVerificationBoxProps = {
  code: string;
  onCodeChange: (code: string) => void;
  codeSent: boolean;
  verified: boolean;
  remainingSec: number;
  sending: boolean;
  verifying: boolean;
  onSend: () => void;
  onVerify: () => void;
  error?: string | null;
  sellerPhone?: string;
  children?: ReactNode;
};

export function PhoneVerificationBox({
  code,
  onCodeChange,
  codeSent,
  verified,
  remainingSec,
  sending,
  verifying,
  onSend,
  onVerify,
  error,
  sellerPhone,
  children,
}: PhoneVerificationBoxProps) {
  return (
    <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
      <p className="text-xs font-semibold text-stone-600">휴대폰 인증</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onSend}
          disabled={sending}
          className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-700 disabled:opacity-60 sm:flex-1"
        >
          {sending ? "요청 중..." : "인증번호 받기"}
        </button>
        <input
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="인증번호"
          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm sm:w-32"
        />
        <button
          type="button"
          onClick={onVerify}
          disabled={verifying || !codeSent || remainingSec <= 0}
          className="rounded-xl bg-lime-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60 sm:whitespace-nowrap"
        >
          {verifying ? "확인 중..." : "확인"}
        </button>
      </div>
      {error && (
        <p className="text-xs font-semibold text-red-600">{error}</p>
      )}
      {codeSent && !verified && (
        <p className={`text-xs font-semibold ${remainingSec > 0 ? "text-amber-700" : "text-red-600"}`}>
          인증번호 유효시간: {formatCountdown(remainingSec)}
        </p>
      )}
      <PhoneContactMessage sellerPhone={sellerPhone} />
      <p className={`text-xs font-semibold ${verified ? "text-lime-700" : "text-stone-500"}`}>
        {verified ? "인증 완료" : "인증 필요"}
      </p>
      {children}
    </div>
  );
}
