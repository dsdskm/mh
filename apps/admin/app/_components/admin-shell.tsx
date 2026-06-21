import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
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

function getBusinessStatusLabel(status: "open" | "standby" | "closed"): string {
  if (status === "open") {
    return "영업중";
  }
  if (status === "standby") {
    return "영업 대기";
  }
  return "영업 종료";
}

function getBusinessStatusBadgeClass(status: "open" | "standby" | "closed"): string {
  if (status === "open") {
    return "border-lime-300 bg-lime-50 text-lime-700";
  }
  if (status === "standby") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }
  return "border-rose-300 bg-rose-50 text-rose-700";
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
  const [showBusinessTextModal, setShowBusinessTextModal] = useState(false);
  const [showBusinessStatusConfirmModal, setShowBusinessStatusConfirmModal] = useState(false);
  const [pendingBusinessStatus, setPendingBusinessStatus] = useState<"open" | "standby" | "closed" | null>(null);
  const [savingBusinessStatus, setSavingBusinessStatus] = useState(false);
  const [openTextDraft, setOpenTextDraft] = useState("");
  const [standbyTextDraft, setStandbyTextDraft] = useState("");
  const [closedTextDraft, setClosedTextDraft] = useState("");

  useEffect(() => {
    if (!state.config) {
      return;
    }

    setOpenTextDraft(state.config.businessStatusOpenText ?? "");
    setStandbyTextDraft(state.config.businessStatusStandbyText ?? "");
    setClosedTextDraft(state.config.businessStatusClosedText ?? "");
  }, [state.config]);

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

    // 주문 접수·취소 요청은 최신 순서대로 12건만 수집해 알림 레코드 유무와 관계없이 표시합니다.
    const orderRecordAlerts: AlertItem[] = [];
    for (const order of state.orders) {
      if (orderRecordAlerts.length >= 12) {
        break;
      }

      if (
        order.status !== ORDER_STATUS.RECEIVED &&
        order.status !== ORDER_STATUS.CANCEL_REQUESTED
      ) {
        continue;
      }

      if (notificationAlerts.some(
        (alert) => alert.kind === "ORDER" && alert.preview.includes(String(order.id)),
      )) {
        continue;
      }

      const isCancel = order.status === ORDER_STATUS.CANCEL_REQUESTED;
      orderRecordAlerts.push({
        id: `${isCancel ? "order-cancel-" : "order-received-"}${order.id}`,
        kind: "ORDER" as const,
        text: isCancel
          ? "주문 취소 요청이 접수되었습니다."
          : "신규 주문이 접수되었습니다.",
        preview: `${order.customerName} 님 주문 ${order.id}`,
        createdAt: order.createdAt,
        url: `/orders#orders:${order.id}`,
      });
    }

    return [...notificationAlerts, ...orderRecordAlerts]
      .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))
      .slice(0, 12);
  }, [state.notifications, state.orders, readAlertIds]);

  async function updateBusinessStatus(nextStatus: "open" | "standby" | "closed") {
    if (!state.config || savingBusinessStatus) {
      return;
    }

    if (state.config.businessStatus === nextStatus) {
      return;
    }

    setPendingBusinessStatus(nextStatus);
    setShowBusinessStatusConfirmModal(true);
  }

  async function confirmBusinessStatusChange() {
    if (!state.config || savingBusinessStatus || !pendingBusinessStatus) {
      return;
    }

    setSavingBusinessStatus(true);
    try {
      await state.saveConfigDirect({
        businessStatus: pendingBusinessStatus,
      });
      setShowBusinessStatusConfirmModal(false);
      setPendingBusinessStatus(null);
    } finally {
      setSavingBusinessStatus(false);
    }
  }

  async function saveBusinessStatusTexts() {
    if (!state.config || savingBusinessStatus) {
      return;
    }

    setSavingBusinessStatus(true);
    try {
      const ok = await state.saveConfigDirect({
        businessStatusOpenText: openTextDraft.trim(),
        businessStatusStandbyText: standbyTextDraft.trim(),
        businessStatusClosedText: closedTextDraft.trim(),
      });

      if (ok) {
        setShowBusinessTextModal(false);
      }
    } finally {
      setSavingBusinessStatus(false);
    }
  }

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
      <main className="ml-60 flex-1 overflow-auto pb-10 pr-80">
        <div className="fixed left-60 right-80 top-0 z-30 border-b border-lime-200 bg-white/90 px-3 py-3 backdrop-blur sm:px-4 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-extrabold text-stone-900">운영 상태</p>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-bold ${getBusinessStatusBadgeClass(
                  state.config?.businessStatus ?? "open",
                )}`}
              >
                {getBusinessStatusLabel(state.config?.businessStatus ?? "open")}
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                알림 {commonAlerts.length}건
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={state.config?.businessStatus ?? "open"}
                onChange={(event) =>
                  void updateBusinessStatus(event.target.value as "open" | "standby" | "closed")
                }
                disabled={!state.config || savingBusinessStatus}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800 disabled:opacity-60"
              >
                <option value="open">영업중</option>
                <option value="standby">영업 대기</option>
                <option value="closed">영업 종료</option>
              </select>
              <button
                type="button"
                onClick={() => setShowBusinessTextModal(true)}
                disabled={!state.config || savingBusinessStatus}
                className="rounded-lg border border-lime-300 bg-lime-50 px-3 py-2 text-sm font-bold text-lime-800 disabled:opacity-60"
              >
                상태 문구 편집
              </button>
            </div>
          </div>
          {state.config && (
            <p className="mt-2 line-clamp-1 text-xs text-stone-600">
              현재 노출 문구: {state.config.businessStatus === "open"
                ? state.config.businessStatusOpenText
                : state.config.businessStatus === "standby"
                  ? state.config.businessStatusStandbyText
                  : state.config.businessStatusClosedText}
            </p>
          )}
        </div>

        <div className="px-3 pt-28 sm:px-4 lg:px-6">
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

      {showBusinessTextModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (!savingBusinessStatus) {
              setShowBusinessTextModal(false);
            }
          }}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold text-stone-900">영업 상태 문구 설정</h2>
            <p className="mt-1 text-sm text-stone-600">웹 주문 화면에 상태별로 표시할 문구를 입력하세요.</p>

            <div className="mt-4 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-lime-700">영업중 문구</span>
                <textarea
                  value={openTextDraft}
                  onChange={(event) => setOpenTextDraft(event.target.value)}
                  className="h-20 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  placeholder="예) 현재 정상 영업 중입니다."
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-amber-700">영업 대기 문구</span>
                <textarea
                  value={standbyTextDraft}
                  onChange={(event) => setStandbyTextDraft(event.target.value)}
                  className="h-20 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  placeholder="예) 영업 준비 중입니다. 잠시 후 다시 방문해주세요."
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-rose-700">영업 종료 문구</span>
                <textarea
                  value={closedTextDraft}
                  onChange={(event) => setClosedTextDraft(event.target.value)}
                  className="h-20 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  placeholder="예) 오늘 영업이 종료되었습니다."
                />
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowBusinessTextModal(false)}
                disabled={savingBusinessStatus}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-bold text-stone-700 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void saveBusinessStatusTexts()}
                disabled={savingBusinessStatus}
                className="flex-1 rounded-lg bg-lime-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {savingBusinessStatus ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBusinessStatusConfirmModal && pendingBusinessStatus && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (!savingBusinessStatus) {
              setShowBusinessStatusConfirmModal(false);
              setPendingBusinessStatus(null);
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold text-stone-900">상태 변경 확인</h2>
            <p className="mt-2 text-sm text-stone-700">
              영업 상태를 <span className="font-bold">{getBusinessStatusLabel(pendingBusinessStatus)}</span>(으)로 변경할까요?
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowBusinessStatusConfirmModal(false);
                  setPendingBusinessStatus(null);
                }}
                disabled={savingBusinessStatus}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-bold text-stone-700 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmBusinessStatusChange()}
                disabled={savingBusinessStatus}
                className="flex-1 rounded-lg bg-lime-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {savingBusinessStatus ? "변경 중..." : "변경"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}