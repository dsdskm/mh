import { API_BASE } from "./constants";
import { parseJsonOrThrow } from "./api-common";
import { Notice } from "./types";

export type NoticePayload = {
  title: string;
  content: string;
  isImportant: boolean;
  isPublished: boolean;
  popupStartAt: string | null;
  popupEndAt: string | null;
};

export async function getAdminNoticesApi(): Promise<Notice[]> {
  const response = await fetch(`${API_BASE}/api/backoffice/notices`, { cache: "no-store" });
  return parseJsonOrThrow<Notice[]>(response, "공지사항 목록을 불러오지 못했습니다.");
}

export async function createAdminNoticeApi(payload: NoticePayload): Promise<Notice> {
  const response = await fetch(`${API_BASE}/api/backoffice/notices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<Notice>(response, "공지사항 등록에 실패했습니다.");
}

export async function updateAdminNoticeApi(id: number, payload: Partial<NoticePayload>): Promise<Notice> {
  const response = await fetch(`${API_BASE}/api/backoffice/notices/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<Notice>(response, "공지사항 수정에 실패했습니다.");
}

export async function deleteAdminNoticeApi(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/api/backoffice/notices/${id}`, {
    method: "DELETE",
  });

  await parseJsonOrThrow<{ ok: boolean }>(response, "공지사항 삭제에 실패했습니다.");
}