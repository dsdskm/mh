"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAdminAlert } from "../../_lib/admin-alert-context";
import { createAdminInquiryCommentApi } from "../../_lib/api";
import { formatPhone } from "../../_lib/constants";
import { AdminNotification, Inquiry } from "../../_lib/types";
import { PaginationControls } from "../../_components/pagination-controls";
import { usePersistedPagination } from "../../_hooks/use-persisted-pagination";

type Props = {
  inquiries: Inquiry[];
  notifications: AdminNotification[];
  deleteInquiry: (inquiryId: string) => Promise<void>;
};

function isOperatorAuthor(name: string): boolean {
  return /운영자|관리자/.test(name);
}

function hasOperatorComment(inquiry: Inquiry): boolean {
  const comments = Array.isArray(inquiry.comments) ? inquiry.comments : [];
  return comments.some((comment) => isOperatorAuthor(comment.name));
}

function getInquiryStatus(inquiry: Inquiry): "NEW" | "REPLIED" {
  return hasOperatorComment(inquiry) ? "REPLIED" : "NEW";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export function InquiriesTab({ inquiries, notifications, deleteInquiry }: Props) {
  const { markAlertAsRead } = useAdminAlert();
  const [items, setItems] = useState<Inquiry[]>(inquiries);
  const [locallyReadNotificationIds, setLocallyReadNotificationIds] = useState<Set<number>>(new Set());
  const [detailInquiryId, setDetailInquiryId] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingInquiryId, setDeletingInquiryId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Inquiry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setItems(inquiries);
  }, [inquiries]);

  // URL hash에서 inquiry ID 읽어서 자동으로 detail 열기
  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith("inquiries:")) {
        const id = hash.replace("inquiries:", "");
        setDetailInquiryId(id);
      }
    }
    
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const sortedInquiries = useMemo(
    () => [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [items],
  );

  const filteredInquiries = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return sortedInquiries;
    
    return sortedInquiries.filter((inq) => {
      const haystack = [inq.title, inq.name, inq.phone, inq.message].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [sortedInquiries, searchQuery]);

  const { currentPage, setCurrentPage, totalPages, pageSize, setPageSize, pageSizeOptions, startIndex, endIndex } = usePersistedPagination({
    storageKey: "admin:pagination:inquiries",
    totalItems: filteredInquiries.length,
    pageSizeOptions: [20, 50, 100],
    resetDeps: [searchQuery],
  });

  const paginatedInquiries = filteredInquiries.slice(startIndex, endIndex);

  const detailInquiry = useMemo(
    () => items.find((inquiry) => inquiry.id === detailInquiryId) ?? null,
    [items, detailInquiryId],
  );
  const detailComments = Array.isArray(detailInquiry?.comments) ? detailInquiry.comments : [];

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailInquiry) {
      return;
    }

    const content = commentContent.trim();
    if (!content) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const updated = await createAdminInquiryCommentApi(detailInquiry.id, {
        name: "운영자",
        content,
      });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setCommentContent("");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "댓글 등록에 실패했습니다.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function performDeleteInquiry(inquiry: Inquiry) {
    setDeletingInquiryId(inquiry.id);
    setDeleteError(null);
    try {
      await deleteInquiry(inquiry.id);
      setDetailInquiryId((prev) => (prev === inquiry.id ? null : prev));
      setCommentContent("");
      setDeleteTarget(null);
    } catch (deleteError) {
      setDeleteError(deleteError instanceof Error ? deleteError.message : "문의 삭제에 실패했습니다.");
    } finally {
      setDeletingInquiryId(null);
    }
  }

  function requestDeleteInquiry(inquiry: Inquiry) {
    setDeleteError(null);
    setDeleteTarget(inquiry);
  }

  function getUnreadInquiryNotificationIds(inquiry: Inquiry): number[] {
    return notifications
      .filter((notification) => notification.type === "inquiry")
      .filter((notification) => !notification.isRead)
      .filter((notification) => !locallyReadNotificationIds.has(notification.id))
      .filter((notification) => {
        const combined = `${notification.title} ${notification.content}`;
        return combined.includes(inquiry.title) || combined.includes(inquiry.name);
      })
      .map((notification) => notification.id);
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-3xl text-lime-800">문의내역</h2>

      {/* search */}
      <input
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
        }}
        placeholder="작성자·제목·내용 검색"
        className="w-full max-w-sm rounded-xl border border-stone-300 px-3 py-2 text-sm"
      />

      {/* table */}
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full bg-white text-sm">
          <thead className="bg-stone-50 text-xs font-semibold text-stone-600">
            <tr>
              <th className="px-3 py-2 text-left">작성자</th>
              <th className="px-3 py-2 text-left">제목</th>
              <th className="px-3 py-2 text-left">댓글</th>
              <th className="px-3 py-2 text-left">수정일시</th>
              <th className="px-3 py-2 text-left">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {paginatedInquiries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-stone-400">
                  {filteredInquiries.length === 0 && searchQuery ? "검색 결과 없음" : "등록된 문의가 없습니다"}
                </td>
              </tr>
            )}
            {paginatedInquiries.map((inquiry) => {
              const comments = Array.isArray(inquiry.comments) ? inquiry.comments : [];
              const unreadNotificationIds = getUnreadInquiryNotificationIds(inquiry);
              const hasUnread = unreadNotificationIds.length > 0;
              return (
                <tr
                  key={inquiry.id}
                  className="hover:bg-stone-50 cursor-pointer"
                  onClick={() => {
                    if (hasUnread) {
                      unreadNotificationIds.forEach((id) => {
                        markAlertAsRead(String(id));
                      });
                      setLocallyReadNotificationIds((prev) => new Set([...prev, ...unreadNotificationIds]));
                    }
                    setDetailInquiryId(inquiry.id);
                    setCommentContent("");
                    setError(null);
                  }}
                >
                  <td className="px-3 py-3 font-medium text-stone-900">{inquiry.name}</td>
                  <td className="px-3 py-3 text-stone-700">
                    <div className="flex items-center gap-2">
                      <span className="line-clamp-1">{inquiry.title}</span>
                      {hasUnread && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-extrabold text-red-700">
                          신규
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      hasOperatorComment(inquiry)
                        ? "bg-lime-100 text-lime-800"
                        : "bg-stone-100 text-stone-600"
                    }`}>
                      {comments.length}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-stone-500 text-xs">{formatDateTime(inquiry.updatedAt ?? inquiry.createdAt)}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void requestDeleteInquiry(inquiry);
                      }}
                      disabled={deletingInquiryId === inquiry.id}
                      className="rounded-lg border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700 disabled:opacity-60"
                    >
                      {deletingInquiryId === inquiry.id ? "삭제 중..." : "삭제"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredInquiries.length}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={setPageSize}
        onPageChange={setCurrentPage}
      />

      {/* detail popup */}
      {detailInquiry && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-stone-900">문의 상세</h3>
                  {getInquiryStatus(detailInquiry) === "NEW" && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-800">
                      답변대기
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  {detailInquiry.name} · {formatPhone(detailInquiry.phone)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void requestDeleteInquiry(detailInquiry)}
                  disabled={deletingInquiryId === detailInquiry.id || submitting}
                  className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 disabled:opacity-60"
                >
                  {deletingInquiryId === detailInquiry.id ? "삭제 중..." : "삭제"}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailInquiryId(null)}
                  className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-600"
                >
                  닫기
                </button>
              </div>
            </div>

            {deleteError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{deleteError}</p>
            )}

            <div className="mt-4 rounded-xl bg-stone-50 p-3">
              <p className="text-sm font-semibold text-stone-900">{detailInquiry.title}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{detailInquiry.message}</p>
            </div>

            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-stone-500">댓글</p>
              <div className="max-h-72 space-y-1 overflow-auto rounded-xl bg-stone-50 p-3">
                {detailComments.length === 0 ? (
                  <p className="text-xs text-stone-400">등록된 댓글이 없습니다.</p>
                ) : (
                  detailComments.map((comment) => (
                    <div key={comment.id} className="rounded-lg bg-white/70 p-2 text-xs text-stone-700">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <span
                          className={`rounded-full px-2 py-0.5 ${
                            isOperatorAuthor(comment.name)
                              ? "bg-lime-100 text-lime-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isOperatorAuthor(comment.name) ? "운영" : "고객"}
                        </span>
                        <span className="text-stone-600">{comment.name}</span>
                      </p>
                      <p className="mt-1">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <form onSubmit={(event) => void submitComment(event)} className="mt-4 space-y-2">
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
              )}
              <textarea
                value={commentContent}
                onChange={(event) => setCommentContent(event.target.value)}
                placeholder="댓글 입력..."
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs"
                rows={2}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !commentContent.trim()}
                  className="rounded-xl bg-lime-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {submitting ? "등록 중..." : "댓글 등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-bold text-stone-900">문의 삭제 확인</h3>
            <p className="mt-2 text-sm text-stone-700">문의 "{deleteTarget.title}"을(를) 삭제할까요?</p>
            {deleteError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{deleteError}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingInquiryId === deleteTarget.id}
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void performDeleteInquiry(deleteTarget)}
                disabled={deletingInquiryId === deleteTarget.id}
                className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {deletingInquiryId === deleteTarget.id ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
