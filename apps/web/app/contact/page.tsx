"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002";
const LAST_INQUIRY_KEY = "cornmarket:last-inquiry";

type LastInquiry = {
  id: string;
  name: string;
  phone: string;
  title: string;
  message: string;
  createdAt: string;
};

export default function ContactPage() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastInquiry, setLastInquiry] = useState<LastInquiry | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LAST_INQUIRY_KEY);
    if (!stored) {
      return;
    }

    try {
      setLastInquiry(JSON.parse(stored) as LastInquiry);
    } catch {
      localStorage.removeItem(LAST_INQUIRY_KEY);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isLoggedIn) {
      setError("문의 작성은 로그인 후 이용할 수 있어요.");
      await signIn("kakao", { callbackUrl: "/contact" });
      return;
    }

    if (!inquiryPhone.trim()) {
      setError("연락처를 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setDoneId(null);

    try {
      const response = await fetch(`${API_BASE}/api/inquiries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: session?.user?.name ?? "회원",
          phone: inquiryPhone,
          title,
          message,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "문의 접수에 실패했습니다.");
      }

      const result = (await response.json()) as { id: string };
      const savedInquiry: LastInquiry = {
        id: result.id,
        name: session?.user?.name ?? "회원",
        phone: inquiryPhone,
        title,
        message,
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(LAST_INQUIRY_KEY, JSON.stringify(savedInquiry));
      setLastInquiry(savedInquiry);
      setDoneId(result.id);
      setTitle("");
      setMessage("");
      setInquiryPhone("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "문의 실패");
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
        <h1 className="font-display text-3xl text-amber-800">문의하기</h1>
        <p className="mt-1 text-sm text-stone-600">주문/배송/상품 문의를 남겨주세요. 작성은 카카오 로그인 후 가능합니다.</p>

        {!isLoggedIn ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">문의 작성 전 카카오 로그인이 필요해요.</p>
            <button
              type="button"
              onClick={() => void signIn("kakao", { callbackUrl: "/contact" })}
              className="mt-3 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white"
            >
              카카오 로그인
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-lime-200 bg-lime-50 p-3">
            <p className="text-sm text-lime-900">{session?.user?.name ?? "회원"}님 카카오 로그인됨</p>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/contact" })}
              className="rounded-lg border border-lime-300 bg-white px-2 py-1 text-xs font-semibold text-lime-900"
            >
              로그아웃
            </button>
          </div>
        )}

        <form className="mt-4 space-y-3" onSubmit={submit}>
          <input
            value={inquiryPhone}
            onChange={(event) => setInquiryPhone(event.target.value)}
            placeholder="연락처"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="문의 제목"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="문의 내용"
            className="h-32 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={submitting || !isLoggedIn}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? "접수 중..." : "문의 접수"}
          </button>
        </form>

        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {doneId && (
          <p className="mt-3 rounded-xl bg-lime-50 p-3 text-sm text-lime-800">접수 완료: {doneId}</p>
        )}

        {lastInquiry && (
          <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-stone-900">최근 내가 남긴 문의</p>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(LAST_INQUIRY_KEY);
                  setLastInquiry(null);
                }}
                className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs font-semibold text-stone-700"
              >
                지우기
              </button>
            </div>
            <p className="mt-2 text-xs text-stone-500">문의번호: {lastInquiry.id}</p>
            <p className="mt-1 text-xs text-stone-500">접수시각: {new Date(lastInquiry.createdAt).toLocaleString()}</p>
            <p className="mt-3 text-sm font-semibold text-stone-900">{lastInquiry.title}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{lastInquiry.message}</p>
          </div>
        )}
      </section>
    </main>
  );
}
