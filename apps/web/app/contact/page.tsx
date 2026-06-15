"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";
import { getProfileApi } from "../account/api/account.api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9000";

type LastInquiry = {
  id: string;
  name: string;
  phone: string;
  title: string;
  message: string;
  createdAt: string;
  comments: Array<{
    id: string;
    name: string;
    content: string;
    createdAt: string;
  }>;
};

function isOperatorAuthor(name: string): boolean {
  return /운영자|관리자/.test(name);
}

export default function ContactPage() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastInquiry, setLastInquiry] = useState<LastInquiry | null>(null);

  async function loadLatestInquiryByPhone(phone: string) {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      setLastInquiry(null);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/inquiries/latest?phone=${encodeURIComponent(normalizedPhone)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        setLastInquiry(null);
        return;
      }

      const latest = (await response.json()) as LastInquiry | null;
      if (!latest) {
        setLastInquiry(null);
        return;
      }

      setLastInquiry({
        ...latest,
        comments: Array.isArray(latest.comments) ? latest.comments : [],
      });
    } catch {
      setLastInquiry(null);
    }
  }

  useEffect(() => {
    async function loadDefaultInquiryPhone() {
      if (!isLoggedIn || inquiryPhone.trim()) {
        return;
      }

      const userId = session?.user?.email?.trim();
      if (!userId) {
        return;
      }

      try {
        const profileData = await getProfileApi(userId);
        const profilePhone = profileData.profile.phone?.trim();
        if (profilePhone) {
          setInquiryPhone(profilePhone);
          await loadLatestInquiryByPhone(profilePhone);
        } else {
          setLastInquiry(null);
        }
      } catch {
        // 기본 연락처 조회 실패 시 수동 입력 가능하도록 조용히 무시합니다.
        setLastInquiry(null);
      }
    }

    void loadDefaultInquiryPhone();
  }, [isLoggedIn, inquiryPhone, session?.user?.email]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isLoggedIn) {
      setError("문의 작성은 로그인 후 이용할 수 있어요.");
      return;
    }

    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }

    if (!message.trim()) {
      setError("내용을 입력해주세요.");
      return;
    }

    if (!inquiryPhone.trim()) {
      setError("연락처를 입력해주세요.");
      return;
    }

    setError(null);
    setShowSubmitConfirmModal(true);
  }

  async function confirmSubmitInquiry() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setShowSubmitConfirmModal(false);
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

      const result = (await response.json()) as LastInquiry;
      const savedInquiry: LastInquiry = {
        id: result.id,
        name: session?.user?.name ?? "회원",
        phone: inquiryPhone,
        title,
        message,
        createdAt: result.createdAt,
        comments: Array.isArray(result.comments) ? result.comments : [],
      };

      setLastInquiry(savedInquiry);
      setDoneId(result.id);
      setTitle("");
      setMessage("");
      setShowInquiryForm(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "문의 실패");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInquiryComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isLoggedIn || !lastInquiry) {
      setError("로그인 후 문의 댓글을 작성할 수 있어요.");
      return;
    }

    const content = commentContent.trim();
    if (!content) {
      setError("댓글 내용을 입력해주세요.");
      return;
    }

    setCommentSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/inquiries/${lastInquiry.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: session?.user?.name ?? "회원",
          content,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "댓글 등록에 실패했습니다.");
      }

      const updated = (await response.json()) as LastInquiry;
      const normalized = {
        ...updated,
        comments: Array.isArray(updated.comments) ? updated.comments : [],
      };

      setLastInquiry(normalized);
      setCommentContent("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "댓글 등록 실패");
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function confirmDeleteLastInquiry() {
    if (!lastInquiry || deleteSubmitting) {
      return;
    }

    setDeleteSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/inquiries/${lastInquiry.id}`, {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 404) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "문의 삭제에 실패했습니다.");
      }

      setLastInquiry(null);
      setShowDeleteConfirmModal(false);
      setDoneId(null);
      setCommentContent("");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "문의 삭제 실패");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-4 py-6">
      <Link href="/" className="text-sm font-semibold text-amber-700">
        ← 홈으로
      </Link>

      <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow">
        <h1 className="font-display text-3xl text-amber-800">문의하기</h1>
        <p className="mt-1 text-sm text-stone-600">주문/배송/상품 문의를 남겨주세요.</p>

        {!showInquiryForm ? (
          <button
            type="button"
            onClick={() => {
              setShowInquiryForm(true);
              setError(null);
              setDoneId(null);
            }}
            className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white"
          >
            문의 작성하기
          </button>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={submit}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="제목"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              required
            />
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="내용"
              className="h-32 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              required
            />
            <input
              value={inquiryPhone}
              onChange={(event) => setInquiryPhone(event.target.value)}
              placeholder="연락처"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              required
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowInquiryForm(false)}
                className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={submitting || !isLoggedIn}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {submitting ? "접수 중..." : "문의 접수"}
              </button>
            </div>
          </form>
        )}

        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {doneId && (
          <p className="mt-3 rounded-xl bg-lime-50 p-3 text-sm text-lime-800">접수 완료: {doneId}</p>
        )}

        {!showInquiryForm && lastInquiry && (
          <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-stone-900">최근 내가 남긴 문의</p>
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(true)}
                className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs font-semibold text-stone-700"
              >
                지우기
              </button>
            </div>
            <p className="mt-2 text-xs text-stone-500">접수시각: {new Date(lastInquiry.createdAt).toLocaleString()}</p>
            <p className="mt-3 text-sm font-semibold text-stone-900">{lastInquiry.title}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{lastInquiry.message}</p>
            <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
              <p className="text-xs font-semibold text-amber-800">댓글 내역</p>
              {lastInquiry.comments.length === 0 ? (
                <p className="mt-1 text-xs text-stone-500">아직 등록된 댓글이 없습니다.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {lastInquiry.comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg bg-amber-50 p-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900">
                        <span
                          className={`rounded-full px-2 py-0.5 ${
                            isOperatorAuthor(comment.name)
                              ? "bg-lime-100 text-lime-800"
                              : "bg-amber-200 text-amber-900"
                          }`}
                        >
                          {isOperatorAuthor(comment.name) ? "운영" : "고객"}
                        </span>
                        <span>{comment.name}</span>
                        <span className="text-stone-500">· {new Date(comment.createdAt).toLocaleString()}</span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={submitInquiryComment} className="mt-3 space-y-2">
              <textarea
                value={commentContent}
                onChange={(event) => setCommentContent(event.target.value)}
                placeholder="추가 댓글을 입력하세요"
                className="h-24 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                required
              />
              <button
                type="submit"
                disabled={commentSubmitting || !isLoggedIn}
                className="w-full rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {commentSubmitting ? "등록 중..." : "댓글 등록"}
              </button>
            </form>
          </div>
        )}
      </section>

      {showSubmitConfirmModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          onClick={() => !submitting && setShowSubmitConfirmModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-3xl text-amber-800">문의 접수 확인</h2>
            <p className="mt-2 text-sm text-stone-700">작성한 내용으로 문의를 접수할까요?</p>

            <div className="mt-4 space-y-2 rounded-2xl bg-amber-50 p-3 text-sm text-stone-800">
              <p><span className="font-semibold">제목</span> {title}</p>
              <p className="whitespace-pre-wrap"><span className="font-semibold">내용</span> {message}</p>
              <p><span className="font-semibold">연락처</span> {inquiryPhone}</p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirmModal(false)}
                disabled={submitting}
                className="flex-1 rounded-xl border border-stone-300 px-4 py-2 text-sm font-bold text-stone-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmSubmitInquiry()}
                disabled={submitting}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {submitting ? "접수 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirmModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          onClick={() => !deleteSubmitting && setShowDeleteConfirmModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-3xl text-amber-800">문의 내역 삭제</h2>
            <p className="mt-2 text-sm text-stone-700">최근 문의 내역을 삭제할까요?</p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                disabled={deleteSubmitting}
                className="flex-1 rounded-xl border border-stone-300 px-4 py-2 text-sm font-bold text-stone-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteLastInquiry()}
                disabled={deleteSubmitting}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {deleteSubmitting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
