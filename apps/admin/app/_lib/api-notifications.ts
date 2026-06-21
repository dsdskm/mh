import { API_BASE } from "./constants";
import { adminFetch, parseJsonOrThrow } from "./api-common";
import { AdminNotification } from "./types";

export async function fetchAdminNotificationsApi(): Promise<AdminNotification[]> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/notifications?limit=12`, { cache: "no-store" });
  const data = await parseJsonOrThrow<{ notifications: AdminNotification[] }>(
    response,
    "알림 목록을 불러오지 못했습니다.",
  );
  return data.notifications;
}

export async function markAdminNotificationAsReadApi(notificationId: number): Promise<void> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("알림 읽음 표시에 실패했습니다.");
  }
}
