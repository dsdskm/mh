import { ReactNode, useCallback, useMemo, useState } from "react";
import { AdminLogin } from "./admin-login";
import { AdminSidebar } from "./admin-sidebar";
import { AdminAlertContext } from "../_lib/admin-alert-context";
import { TABS } from "../_lib/constants";
import { AdminPageState } from "../_hooks/use-admin-page";
import { AdminTab } from "../_lib/types";
import { AdminNotificationType } from "../_lib/types";
import { markAdminNotificationAsReadApi } from "../_lib/api-notifications";
import { ORDER_STATUS } from "@repo/shared-types/order";

type AlertKind = "ORDER" | "INQUIRY" | "REVIEW" | "INQUIRY_COMMENT" | "REVIEW_COMMENT";

type AlertItem = {
  id: string;
  kind: AlertKind;
  text: string;
  preview: string;
  createdAt: string;
  url: string;
};

function isOperatorAuthor(name: string): boolean {
  return /운영자|관리자/.test(name);
}

function toTime(createdAt: string): number {
  const parsed = new Date(createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getKindBadgeStyle(kind: AlertKind): string {
  if (kind === "ORDER") {
    return "bg-lime-100 text-lime-800";
  }
  if (kind === "INQUIRY") {
    return "bg-amber-100 text-amber-800";
  }
  if (kind === "REVIEW") {
    return "bg-violet-100 text-violet-800";
  }
  if (kind === "INQUIRY_COMMENT") {
    return "bg-lime-100 text-lime-800";
  }
  return "bg-emerald-100 text-emerald-800";
}

function getKindLabel(kind: AlertKind): string {
  if (kind === "ORDER") {
    return "주문";
  }
  if (kind === "INQUIRY") {
    return "문의";
  }
  if (kind === "REVIEW") {
    return "후기";
  }
  if (kind === "INQUIRY_COMMENT") {
    return "문의댓글";
  }
  return "후기댓글";
}

function isCancelRequestOrderAlert(alert: AlertItem): boolean {
  if (alert.kind !== "ORDER") {
    return false;
  }

  return alert.id.startsWith("order-cancel-") || alert.text.includes("취소 요청");
}

function getAlertBadgeStyle(alert: AlertItem): string {
  if (alert.kind !== "ORDER") {
    return getKindBadgeStyle(alert.kind);
  }

  if (isCancelRequestOrderAlert(alert)) {
    return "bg-orange-100 text-orange-700";
  }

  return "bg-lime-100 text-lime-800";
}

function getAlertCardStyle(alert: AlertItem): string {
  if (alert.kind !== "ORDER") {
    return "border-amber-200 bg-white hover:bg-amber-50";
  }

  if (isCancelRequestOrderAlert(alert)) {
    return "border-orange-300 bg-orange-50/80 shadow-sm shadow-orange-100 animate-[pulse_2.2s_ease-in-out_infinite] hover:bg-orange-100/80";
  }

  return "border-lime-300 bg-lime-50/80 shadow-sm shadow-lime-100 animate-[pulse_2.2s_ease-in-out_infinite] hover:bg-lime-100/80";
}

function toAlertKind(type: AdminNotificationType): AlertKind {
  if (type === "order") {
    return "ORDER";
  }
  if (type === "inquiry") {
    return "INQUIRY";
  }
  if (type === "review") {
    return "REVIEW";
  }
  if (type === "inquiry-comment") {
    return "INQUIRY_COMMENT";
  }
  return "REVIEW_COMMENT";
}

type Props = {
  activeTab: AdminTab;
  state: AdminPageState;
  children: ReactNode;
}

export function AdminShell({ activeTab, state, children }: Props) {
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set());

  const markAlertAsRead = useCallback(async (alertId: string) => {
    const notificationId = parseInt(alertId, 10);
    if (Number.isNaN(notificationId)) {
      return;
    }

    try {
      await markAdminNotificationAsReadApi(notificationId);
      setReadAlertIds((prev) => new Set([...prev, alertId]));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }, []);

  const onAlertClick = useCallback((alertId: string, kind: AlertKind) => {
    void kind;
    const notificationId = parseInt(alertId, 10);
    if (Number.isNaN(notificationId)) {
      // 주문내역에서 직접 생성한 합성 알림(주문 접수/취소 요청)은 해당 주문으로 이동
      const orderPrefix = ["order-received-", "order-cancel-"].find((prefix) =>
        alertId.startsWith(prefix),
      );
      if (orderPrefix) {
        const orderId = alertId.replace(orderPrefix, "");
        window.location.href = `/orders#orders:${orderId}`;
      }
      return;
    }

    const notification = state.notifications.find((item) => item.id === notificationId);
    if (!notification) {
      return;
    }

    setReadAlertIds((prev) => new Set([...prev, alertId]));
    void markAdminNotificationAsReadApi(notificationId);
    window.location.href = notification.url;
  }, [state.notifications]);
  const commonAlerts = useMemo<AlertItem[]>(() => {
    const notificationAlerts: AlertItem[] = state.notifications
      .filter((notification) => !notification.isRead)
      .filter((notification) => !readAlertIds.has(String(notification.id)))
      .map((notification) => ({
        id: String(notification.id),
        kind: toAlertKind(notification.type),
        text: notification.title,
        preview: notification.content,
        createdAt: notification.createdAt,
        url: notification.url,
      }));

    // 주문 접수·취소 요청은 실제 주문내역(state.orders)의 값을 그대로 사용해
    // 알림 레코드 유무와 관계없이 누락되지 않게 표시합니다.
    const orderRecordAlerts: AlertItem[] = state.orders
      .filter((order) =>
        order.status === ORDER_STATUS.RECEIVED ||
        order.status === ORDER_STATUS.CANCEL_REQUESTED,
      )
      .filter((order) => !notificationAlerts.some(
        (alert) => alert.kind === "ORDER" && alert.preview.includes(String(order.id)),
      ))
      .map((order) => {
        const isCancel = order.status === ORDER_STATUS.CANCEL_REQUESTED;
        return {
          id: `${isCancel ? "order-cancel-" : "order-received-"}${order.id}`,
          kind: "ORDER" as const,
          text: isCancel
            ? "주문 취소 요청이 접수되었습니다."
            : "신규 주문이 접수되었습니다.",
          preview: `${order.customerName} 님 주문 ${order.id}`,
          createdAt: order.createdAt,
          url: `/orders#orders:${order.id}`,
        };
      });

    return [...notificationAlerts, ...orderRecordAlerts]
      .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))
      .slice(0, 12);
  }, [state.notifications, state.orders, readAlertIds]);

  if (!state.isAuthed) {
    return (
      <AdminLogin
        userId={state.loginUserId}
        password={state.loginPassword}
        error={state.loginError}
        onUserIdChange={state.setLoginUserId}
        onPasswordChange={state.setLoginPassword}
        onSubmit={state.submitLogin}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-admin-pattern text-stone-900">
      {/* 좌측 메뉴 - 고정 */}
      <aside className="fixed left-0 top-0 h-screen w-60 border-r border-lime-200 bg-white/95 shadow-xl">
        <div className="h-full overflow-auto p-4">
          <AdminSidebar tabs={TABS} activeTab={activeTab} onLogout={state.logout} />
        </div>
      </aside>

      {/* 중앙 화면 - 스크롤 가능 */}
      <main className="ml-60 flex-1 overflow-auto pb-10 pt-4 pr-80">
        <div className="px-3 sm:px-4 lg:px-6">
          {state.loading && <p className="text-sm text-stone-600">데이터 불러오는 중...</p>}
          {state.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
          {state.notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{state.notice}</p>}
          <AdminAlertContext.Provider value={{ markAlertAsRead, onAlertClick }}>
            {children}
          </AdminAlertContext.Provider>
        </div>
      </main>

      {/* 우측 알림 영역 - 고정 */}
      <aside className="fixed right-0 top-0 h-screen w-80 border-l border-amber-200 bg-white/95 shadow-xl">
        <div className="h-full overflow-auto p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-extrabold text-amber-900">공통 알림</p>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                {commonAlerts.length}건
              </span>
            </div>
            {commonAlerts.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-stone-500">
                표시할 신규 알림이 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {commonAlerts.map((alert) => (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => onAlertClick(alert.id, alert.kind)}
                    className={`w-full rounded-lg border p-2.5 text-left transition ${getAlertCardStyle(alert)}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${getAlertBadgeStyle(alert)}`}>
                        {getKindLabel(alert.kind)}
                      </span>
                      <p className="text-xs font-semibold text-stone-700">{alert.text}</p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-stone-600">{alert.preview}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}