"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAdminAlert } from "../../_lib/admin-alert-context";
import { createAdminReviewCommentApi } from "../../_lib/api";
import { Review } from "../../_lib/types";
import { PaginationControls } from "../../_components/pagination-controls";
import { usePersistedPagination } from "../../_hooks/use-persisted-pagination";

type Props = {
  reviews: Review[];
};

function isOperatorAuthor(name: string): boolean {
  return /운영자|관리자/.test(name);
}

function hasOperatorComment(review: Review): boolean {
  const comments = Array.isArray(review.comments) ? review.comments : [];
  return comments.some((comment) => isOperatorAuthor(comment.name));
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

export function ReviewsTab({ reviews }: Props) {
  const { markAlertAsRead } = useAdminAlert();
  const [items, setItems] = useState<Review[]>(reviews);
  const [detailReviewId, setDetailReviewId] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setItems(reviews);
  }, [reviews]);

  // URL hash에서 review ID 읽어서 자동으로 detail 열기
  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith("reviews:")) {
        const id = hash.replace("reviews:", "");
        setDetailReviewId(id);
      }
    }
    
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const sortedReviews = useMemo(
    () => [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [items],
  );

  const filteredReviews = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return sortedReviews;
    
    return sortedReviews.filter((review) => {
      const haystack = [review.name, review.content].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [sortedReviews, searchQuery]);

  const { currentPage, setCurrentPage, totalPages, pageSize, setPageSize, pageSizeOptions, startIndex, endIndex } = usePersistedPagination({
    storageKey: "admin:pagination:reviews",
    totalItems: filteredReviews.length,
    pageSizeOptions: [20, 50, 100],
    resetDeps: [searchQuery],
  });
  const paginatedReviews = filteredReviews.slice(startIndex, endIndex);

  const detailReview = useMemo(
    () => items.find((review) => review.id === detailReviewId) ?? null,
    [items, detailReviewId],
  );
  const detailComments = Array.isArray(detailReview?.comments) ? detailReview.comments : [];

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detailReview) {
      return;
    }

    const content = commentContent.trim();
    if (!content) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const updated = await createAdminReviewCommentApi(detailReview.id, {
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

  return (
    <div className="space-y-6">
      <h2 className="font-display text-3xl text-lime-800">후기</h2>

      {/* search */}
      <input
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
        }}
        placeholder="이름·내용 검색"
        className="w-full max-w-sm rounded-xl border border-stone-300 px-3 py-2 text-sm"
      />

      {/* table */}
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full bg-white text-sm">
          <thead className="bg-stone-50 text-xs font-semibold text-stone-600">
            <tr>
              <th className="px-3 py-2 text-left">작성자</th>
              <th className="px-3 py-2 text-left">내용</th>
              <th className="px-3 py-2 text-left">댓글</th>
              <th className="px-3 py-2 text-left">수정일시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {paginatedReviews.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-stone-400">
                  {filteredReviews.length === 0 && searchQuery ? "검색 결과 없음" : "등록된 후기가 없습니다"}
                </td>
              </tr>
            )}
            {paginatedReviews.map((review) => {
              const comments = Array.isArray(review.comments) ? review.comments : [];
              return (
                <tr
                  key={review.id}
                  className="hover:bg-stone-50 cursor-pointer"
                  onClick={() => {
                    markAlertAsRead(`review-${review.id}`);
                    setDetailReviewId(review.id);
                    setCommentContent("");
                    setError(null);
                  }}
                >
                  <td className="px-3 py-3 font-medium text-stone-900">{review.name}</td>
                  <td className="px-3 py-3 text-stone-700 line-clamp-1">{review.content}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      hasOperatorComment(review)
                        ? "bg-lime-100 text-lime-800"
                        : "bg-stone-100 text-stone-600"
                    }`}>
                      {comments.length}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-stone-500 text-xs">{formatDateTime(review.updatedAt ?? review.createdAt)}</td>
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
        totalItems={filteredReviews.length}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={setPageSize}
        onPageChange={setCurrentPage}
      />

      {/* detail popup */}
      {detailReview && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onClick={() => !submitting && setDetailReviewId(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-stone-900">후기 상세</h3>
                <p className="mt-0.5 text-xs text-stone-500">{detailReview.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailReviewId(null)}
                className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-600"
              >
                닫기
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-stone-50 p-3">
              <p className="whitespace-pre-wrap text-sm text-stone-700">{detailReview.content}</p>
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
    </div>
  );
}
