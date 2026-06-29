import { API_BASE } from "./constants";
import { adminFetch, parseJsonOrThrow } from "./api-common";
import { Inquiry, Review } from "./types";

type CommentPayload = {
  name: string;
  content: string;
};

export async function createAdminInquiryCommentApi(
  inquiryId: string,
  payload: CommentPayload,
): Promise<Inquiry> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/inquiries/${inquiryId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<Inquiry>(response, "문의 댓글 등록에 실패했습니다.");
}

export async function createAdminReviewCommentApi(
  reviewId: string,
  payload: CommentPayload,
): Promise<Review> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/reviews/${reviewId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<Review>(response, "후기 댓글 등록에 실패했습니다.");
}

export async function deleteAdminReviewApi(reviewId: string): Promise<void> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/reviews/${reviewId}`, {
    method: "DELETE",
  });

  await parseJsonOrThrow<{ ok: boolean }>(response, "후기 삭제에 실패했습니다.");
}

export async function deleteAdminInquiryApi(inquiryId: string): Promise<void> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/inquiries/${inquiryId}`, {
    method: "DELETE",
  });

  await parseJsonOrThrow<{ ok: boolean }>(response, "문의 삭제에 실패했습니다.");
}