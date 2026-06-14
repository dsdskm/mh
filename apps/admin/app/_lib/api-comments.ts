import { API_BASE } from "./constants";
import { parseJsonOrThrow } from "./api-common";
import { Inquiry, Review } from "./types";

type CommentPayload = {
  name: string;
  content: string;
};

export async function createAdminInquiryCommentApi(
  inquiryId: string,
  payload: CommentPayload,
): Promise<Inquiry> {
  const response = await fetch(`${API_BASE}/api/backoffice/inquiries/${inquiryId}/comments`, {
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
  const response = await fetch(`${API_BASE}/api/backoffice/reviews/${reviewId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<Review>(response, "후기 댓글 등록에 실패했습니다.");
}