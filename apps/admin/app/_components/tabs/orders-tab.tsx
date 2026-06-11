import { useMemo, useState } from "react";
import { formatCurrency, formatPhone, STATUS_OPTIONS, getOrderStatusLabelKo } from "../../_lib/constants";
import { Order, OrderStatus } from "../../_lib/types";
import { ORDER_STATUS } from "@repo/shared-types/order";

type DatePreset = "today" | "week" | "month1" | "month3" | "month6" | "year1" | "all" | "custom";

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPresetRange(preset: Exclude<DatePreset, "custom">): { start: string; end: string } {
  const today = new Date();
  const end = formatDateInput(today);

  if (preset === "all") {
    return { start: "", end: "" };
  }

  if (preset === "today") {
    return { start: end, end };
  }

  const startDate = new Date(today);

  if (preset === "week") {
    startDate.setDate(today.getDate() - 6);
  } else if (preset === "month1") {
    startDate.setMonth(today.getMonth() - 1);
  } else if (preset === "month3") {
    startDate.setMonth(today.getMonth() - 3);
  } else if (preset === "month6") {
    startDate.setMonth(today.getMonth() - 6);
  } else if (preset === "year1") {
    startDate.setFullYear(today.getFullYear() - 1);
  }

  return {
    start: formatDateInput(startDate),
    end,
  };
}

type Props = {
  orders: Order[];
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
};

export function OrdersTab({ orders, updateOrderStatus }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const initialWeekRange = getPresetRange("week");
  const [startDate, setStartDate] = useState(initialWeekRange.start);
  const [endDate, setEndDate] = useState(initialWeekRange.end);
  const [datePreset, setDatePreset] = useState<DatePreset>("week");
  const [pendingStatusByOrderId, setPendingStatusByOrderId] = useState<Record<string, OrderStatus>>({});
  const [confirmState, setConfirmState] = useState<{
    orderId: string;
    currentStatus: OrderStatus;
    nextStatus: OrderStatus;
  } | null>(null);
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const dateFilteredOrders = useMemo(() => {
    const startAt = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endAt = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null;

    return orders.filter((order) => {
      const createdAt = new Date(order.createdAt).getTime();

      if (startAt !== null && createdAt < startAt) {
        return false;
      }

      if (endAt !== null && createdAt > endAt) {
        return false;
      }

      return true;
    });
  }, [orders, startDate, endDate]);

  const searchedOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return dateFilteredOrders.filter((order) => {
      if (!query) {
        return true;
      }

      const haystack = [
        order.id,
        order.customerName,
        order.depositorName,
        order.phone,
        order.shippingAddress,
        order.requestNote ?? "",
        order.cancelReason ?? "",
        ...order.items.map((item) => item.name),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [dateFilteredOrders, searchQuery]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") {
      return searchedOrders;
    }

    return searchedOrders.filter((order) => order.status === statusFilter);
  }, [searchedOrders, statusFilter]);

  const summary = useMemo(() => {
    const counts = STATUS_OPTIONS.reduce<Record<OrderStatus, number>>((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<OrderStatus, number>);

    let totalSales = 0;

    for (const order of searchedOrders) {
      counts[order.status] += 1;
      totalSales += order.totalAmount;
    }

    return {
      totalOrders: searchedOrders.length,
      totalSales,
      counts,
    };
  }, [searchedOrders]);

  function getPendingStatus(order: Order): OrderStatus {
    return pendingStatusByOrderId[order.id] ?? order.status;
  }

  function setPendingStatus(orderId: string, status: OrderStatus) {
    setPendingStatusByOrderId((prev) => ({ ...prev, [orderId]: status }));
  }

  async function confirmStatusChange() {
    if (!confirmState) {
      return;
    }

    setSubmittingOrderId(confirmState.orderId);
    setConfirmError(null);
    try {
      await updateOrderStatus(confirmState.orderId, confirmState.nextStatus);
      setPendingStatusByOrderId((prev) => {
        const next = { ...prev };
        delete next[confirmState.orderId];
        return next;
      });
      setConfirmState(null);
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : "상태 변경에 실패했습니다.");
    } finally {
      setSubmittingOrderId(null);
    }
  }

  function getStatusBadgeClass(status: OrderStatus): string {
    if (status === ORDER_STATUS.CANCELLED) {
      return "bg-red-100 text-red-700 border-red-200";
    }

    if (status === ORDER_STATUS.DELIVERED) {
      return "bg-sky-100 text-sky-800 border-sky-200";
    }

    if (status === ORDER_STATUS.SHIPPING) {
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    }

    if (status === ORDER_STATUS.PREPARING) {
      return "bg-amber-100 text-amber-800 border-amber-200";
    }

    if (status === ORDER_STATUS.PAID) {
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }

    return "bg-lime-100 text-lime-800 border-lime-200";
  }

  return (
    <>
      <h2 className="font-display text-3xl text-lime-800">주문내역</h2>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`rounded-2xl border p-4 text-left transition ${
            statusFilter === "all"
              ? "border-lime-500 bg-lime-100 shadow"
              : "border-lime-200 bg-lime-50 hover:bg-lime-100"
          }`}
        >
          <p className="text-xs uppercase tracking-[0.15em] text-lime-700">전체 주문</p>
          <p className="mt-1 text-2xl font-extrabold text-lime-800">{summary.totalOrders}</p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`rounded-2xl border p-4 text-left transition ${
            statusFilter === "all"
              ? "border-amber-500 bg-amber-100 shadow"
              : "border-amber-200 bg-amber-50 hover:bg-amber-100"
          }`}
        >
          <p className="text-xs uppercase tracking-[0.15em] text-amber-700">총 매출</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-800">{formatCurrency(summary.totalSales)}</p>
        </button>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-2xl border bg-white p-4 text-left transition ${
              statusFilter === status
                ? "border-lime-500 bg-lime-50 shadow"
                : "border-stone-200 hover:bg-stone-50"
            }`}
          >
            <p className="text-xs uppercase tracking-[0.12em] text-stone-500">{getOrderStatusLabelKo(status)}</p>
            <p className="mt-1 text-2xl font-extrabold text-stone-900">{summary.counts[status]}</p>
          </button>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="주문번호·고객명·연락처·상품명 검색"
          className="min-w-52 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)}
          className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
        >
          <option value="all">전체 상태</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>{getOrderStatusLabelKo(status)}</option>
          ))}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(event) => {
            setStartDate(event.target.value);
            setDatePreset("custom");
          }}
          className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          aria-label="시작일"
        />
        <input
          type="date"
          value={endDate}
          onChange={(event) => {
            setEndDate(event.target.value);
            setDatePreset("custom");
          }}
          className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          aria-label="종료일"
        />
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setDatePreset("all");
            }}
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700"
          >
            날짜 초기화
          </button>
        )}
        <div className="basis-full">
          <div className="mt-1 flex flex-wrap justify-end gap-2">
            {[
              { key: "today", label: "오늘" },
              { key: "week", label: "일주일" },
              { key: "month1", label: "1개월" },
              { key: "month3", label: "3개월" },
              { key: "month6", label: "6개월" },
              { key: "year1", label: "1년" },
              { key: "all", label: "전체" },
            ].map((item) => {
              const preset = item.key as Exclude<DatePreset, "custom">;
              const isActive = datePreset === preset;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    const range = getPresetRange(preset);
                    setStartDate(range.start);
                    setEndDate(range.end);
                    setDatePreset(preset);
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    isActive
                      ? "border-lime-600 bg-lime-600 text-white"
                      : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredOrders.length === 0 && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-500">
            조건에 맞는 주문이 없습니다.
          </div>
        )}

        {filteredOrders.map((order) => {
          const pendingStatus = getPendingStatus(order);
          const statusChanged = pendingStatus !== order.status;

          return (
            <article key={order.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-sm font-bold text-stone-900">주문번호 {order.id}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        order.purchaseType === "member"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-stone-200 text-stone-700"
                      }`}
                    >
                      {order.purchaseType === "member" ? "회원 주문" : "비회원 주문"}
                    </span>
                    <p className="text-xs text-stone-500">{new Date(order.createdAt).toLocaleString()}</p>
                  </div>

                  <div className="grid gap-2 text-sm text-stone-700 sm:grid-cols-2">
                    <p>고객명: {order.customerName}</p>
                    <p>연락처: {formatPhone(order.phone)}</p>
                    <p>입금자명: {order.depositorName}</p>
                    <p className="font-semibold text-amber-700">주문금액: {formatCurrency(order.totalAmount)}</p>
                  </div>

                  <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                    <p className="text-xs font-semibold text-stone-500">배송지</p>
                    <p className="mt-1">{order.shippingAddress}</p>
                  </div>

                  <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                    <p className="text-xs font-semibold text-stone-500">요청사항</p>
                    <p className="mt-1">{order.requestNote?.trim() ? order.requestNote : "없음"}</p>
                  </div>

                  {order.cancelReason?.trim() && (
                    <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                      <p className="text-xs font-semibold text-red-600">취소 사유</p>
                      <p className="mt-1">{order.cancelReason}</p>
                    </div>
                  )}

                  <div className="rounded-xl bg-stone-50 p-3">
                    <p className="text-xs font-semibold text-stone-500">주문 품목</p>
                    <ul className="mt-2 space-y-1 text-sm text-stone-700">
                      {order.items.map((item) => (
                        <li key={`${order.id}-${item.productId}`} className="flex items-center justify-between gap-2">
                          <span>{item.name} x {item.quantity}</span>
                          <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="w-full rounded-xl border border-stone-200 p-3 lg:w-64">
                  <p className="text-xs font-semibold text-stone-500">현재 상태</p>
                  <p className={`mt-2 rounded-lg border px-3 py-2 text-center text-sm font-bold ${getStatusBadgeClass(order.status)}`}>
                    {getOrderStatusLabelKo(order.status)}
                  </p>

                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-stone-500">변경할 상태</p>
                    <select
                      value={pendingStatus}
                      onChange={(event) => setPendingStatus(order.id, event.target.value as OrderStatus)}
                      aria-label="주문 상태 변경"
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{getOrderStatusLabelKo(status)}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmState({
                          orderId: order.id,
                          currentStatus: order.status,
                          nextStatus: pendingStatus,
                        });
                        setConfirmError(null);
                      }}
                      disabled={!statusChanged || submittingOrderId === order.id}
                      className="w-full rounded-xl bg-lime-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submittingOrderId === order.id ? "처리 중..." : "상태 변경"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {confirmState && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (!submittingOrderId) {
              setConfirmState(null);
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-bold text-stone-900">주문 상태 변경 확인</h3>
            <p className="mt-2 text-sm text-stone-600">주문번호 {confirmState.orderId}</p>
            <p className="mt-1 text-sm text-stone-700">
              {getOrderStatusLabelKo(confirmState.currentStatus)} → {getOrderStatusLabelKo(confirmState.nextStatus)} 로 변경할까요?
            </p>
            {confirmError && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {confirmError}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                disabled={Boolean(submittingOrderId)}
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmStatusChange()}
                disabled={Boolean(submittingOrderId)}
                className="flex-1 rounded-xl bg-lime-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {submittingOrderId ? "처리 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
