import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatCurrency, formatPhone, STATUS_OPTIONS, getOrderStatusLabelKo } from "../../_lib/constants";
import { AdminOrderCreatePayload, AdminOrderUpdatePayload, Order, OrderStatus, Product } from "../../_lib/types";
import { ORDER_STATUS } from "@repo/shared-types/order";
import { PaginationControls } from "../../_components/pagination-controls";
import { usePersistedPagination } from "../../_hooks/use-persisted-pagination";

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
  products: Product[];
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  createOrder: (payload: AdminOrderCreatePayload) => Promise<void>;
  updateOrder: (orderId: string, payload: AdminOrderUpdatePayload) => Promise<void>;
};

export function OrdersTab({ orders, products, updateOrderStatus, createOrder, updateOrder }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const initialWeekRange = getPresetRange("week");
  const [startDate, setStartDate] = useState(initialWeekRange.start);
  const [endDate, setEndDate] = useState(initialWeekRange.end);
  const [datePreset, setDatePreset] = useState<DatePreset>("week");
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [pendingStatusByOrderId, setPendingStatusByOrderId] = useState<Record<string, OrderStatus>>({});
  const [confirmState, setConfirmState] = useState<{
    orderId: string;
    currentStatus: OrderStatus;
    nextStatus: OrderStatus;
  } | null>(null);
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createCustomerName, setCreateCustomerName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createDepositorName, setCreateDepositorName] = useState("");
  const [createShippingAddress, setCreateShippingAddress] = useState("");
  const [createRequestNote, setCreateRequestNote] = useState("");
  const [createQuantities, setCreateQuantities] = useState<Record<number, string>>({});

  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDepositorName, setEditDepositorName] = useState("");
  const [editShippingAddress, setEditShippingAddress] = useState("");
  const [editRequestNote, setEditRequestNote] = useState("");
  const [editCancelReason, setEditCancelReason] = useState("");

  // URL hash에서 order ID 읽어서 자동으로 detail 열기
  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith("orders:")) {
        const id = hash.replace("orders:", "");
        setDetailOrderId(id);
      }
    }
    
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

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

  const { currentPage, setCurrentPage, totalPages, pageSize, setPageSize, pageSizeOptions, startIndex, endIndex } = usePersistedPagination({
    storageKey: "admin:pagination:orders",
    totalItems: filteredOrders.length,
    pageSizeOptions: [20, 50, 100],
    resetDeps: [searchQuery, statusFilter, startDate, endDate],
  });

  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  const summary = useMemo(() => {
    const counts = STATUS_OPTIONS.reduce<Record<OrderStatus, number>>((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<OrderStatus, number>);

    for (const order of searchedOrders) {
      counts[order.status] += 1;
    }

    return {
      counts,
    };
  }, [searchedOrders]);

  const activeProducts = useMemo(() => {
    return products.filter((product) => product.active);
  }, [products]);

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
    if (status === ORDER_STATUS.CANCEL_COMPLETED) {
      return "bg-red-100 text-red-700 border-red-200";
    }

    if (status === ORDER_STATUS.CANCEL_REQUESTED) {
      return "bg-orange-100 text-orange-700 border-orange-200";
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

  function setCreateQuantity(productId: number, value: string) {
    setCreateQuantities((prev) => ({
      ...prev,
      [productId]: value,
    }));
  }

  function resetCreateForm() {
    setCreateCustomerName("");
    setCreatePhone("");
    setCreateDepositorName("");
    setCreateShippingAddress("");
    setCreateRequestNote("");
    setCreateQuantities({});
    setCreateError(null);
  }

  function openEditModal(order: Order) {
    setEditOrderId(order.id);
    setEditCustomerName(order.customerName);
    setEditPhone(order.phone);
    setEditDepositorName(order.depositorName);
    setEditShippingAddress(order.shippingAddress);
    setEditRequestNote(order.requestNote ?? "");
    setEditCancelReason(order.cancelReason ?? "");
    setUpdateError(null);
  }

  async function submitCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);

    const normalizedItems = activeProducts
      .map((product) => ({
        productId: product.id,
        quantity: Number(createQuantities[product.id] ?? "0"),
      }))
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

    if (!normalizedItems.length) {
      setCreateError("최소 1개 이상의 상품을 선택해주세요.");
      return;
    }

    const requestedByProduct = new Map<number, number>();
    for (const item of normalizedItems) {
      requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    for (const [productId, quantity] of requestedByProduct.entries()) {
      const product = activeProducts.find((p) => p.id === productId);
      if (!product) {
        setCreateError(`상품(${productId}) 정보를 찾을 수 없습니다.`);
        return;
      }

      if (product.stock < quantity) {
        setCreateError(`${product.name} 재고(${product.stock})를 초과해 주문할 수 없습니다.`);
        return;
      }
    }

    setCreating(true);
    try {
      await createOrder({
        customerName: createCustomerName.trim(),
        phone: createPhone.trim(),
        depositorName: createDepositorName.trim(),
        shippingAddress: createShippingAddress.trim(),
        requestNote: createRequestNote.trim() || undefined,
        items: normalizedItems,
      });
      setShowCreateModal(false);
      resetCreateForm();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "주문 등록에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }

  async function submitUpdateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editOrderId) {
      return;
    }

    setUpdateError(null);
    setUpdatingOrder(true);
    try {
      await updateOrder(editOrderId, {
        customerName: editCustomerName.trim(),
        phone: editPhone.trim(),
        depositorName: editDepositorName.trim(),
        shippingAddress: editShippingAddress.trim(),
        requestNote: editRequestNote.trim() || "",
        cancelReason: editCancelReason.trim() || null,
      });
      setEditOrderId(null);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : "주문 수정에 실패했습니다.");
    } finally {
      setUpdatingOrder(false);
    }
  }

  return (
    <>
      <h2 className="font-display text-3xl text-lime-800">주문내역</h2>

      <section className="mt-4 flex flex-nowrap gap-3 overflow-x-auto pb-1">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`min-w-[170px] rounded-2xl border bg-white p-4 text-left transition ${
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

      <div className="mt-6 flex flex-wrap gap-2">
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
        <button
          type="button"
          onClick={() => {
            resetCreateForm();
            setShowCreateModal(true);
          }}
          className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white"
        >
          + 주문 추가
        </button>
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

      <div className="mt-8 space-y-4">
        {filteredOrders.length === 0 && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-500">
            조건에 맞는 주문이 없습니다.
          </div>
        )}

        {paginatedOrders.map((order) => {
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
                    <button
                      type="button"
                      onClick={() => openEditModal(order)}
                      className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700"
                    >
                      주문 정보 수정
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredOrders.length}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={setPageSize}
        onPageChange={setCurrentPage}
      />

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

      {showCreateModal && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4"
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-stone-900">주문 추가</h3>
            <form onSubmit={submitCreateOrder} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={createCustomerName} onChange={(e) => setCreateCustomerName(e.target.value)} placeholder="고객명" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
                <input value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} placeholder="연락처" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
                <input value={createDepositorName} onChange={(e) => setCreateDepositorName(e.target.value)} placeholder="입금자명" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
                <input value={createShippingAddress} onChange={(e) => setCreateShippingAddress(e.target.value)} placeholder="배송지" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
              </div>
              <textarea value={createRequestNote} onChange={(e) => setCreateRequestNote(e.target.value)} placeholder="요청사항" className="h-20 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />

              <div className="rounded-xl border border-stone-200 p-3">
                <p className="mb-2 text-xs font-semibold text-stone-600">주문 품목</p>
                <div className="space-y-2">
                  {activeProducts.length === 0 && (
                    <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">주문 가능한 공개 상품이 없습니다.</p>
                  )}
                  {activeProducts.map((product) => (
                    <div key={`create-product-${product.id}`} className="grid grid-cols-[1fr_110px] items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-stone-800">{product.name}</p>
                        <p className="text-[11px] text-stone-500">{formatCurrency(product.price)} · 전체 {product.totalQuantity}개 / 재고 {product.stock}개</p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={product.stock}
                        value={createQuantities[product.id] ?? "0"}
                        disabled={product.stock <= 0}
                        onChange={(e) => setCreateQuantity(product.id, e.target.value)}
                        className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {createError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{createError}</p>}

              <div className="flex gap-2">
                <button type="button" onClick={() => setShowCreateModal(false)} disabled={creating} className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60">취소</button>
                <button type="submit" disabled={creating} className="flex-1 rounded-xl bg-lime-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60">{creating ? "등록 중..." : "주문 등록"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editOrderId && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4"
          onClick={() => !updatingOrder && setEditOrderId(null)}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-stone-900">주문 정보 수정</h3>
            <form onSubmit={submitUpdateOrder} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} placeholder="고객명" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="연락처" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
                <input value={editDepositorName} onChange={(e) => setEditDepositorName(e.target.value)} placeholder="입금자명" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
                <input value={editShippingAddress} onChange={(e) => setEditShippingAddress(e.target.value)} placeholder="배송지" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
              </div>
              <textarea value={editRequestNote} onChange={(e) => setEditRequestNote(e.target.value)} placeholder="요청사항" className="h-20 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              <textarea value={editCancelReason} onChange={(e) => setEditCancelReason(e.target.value)} placeholder="취소 사유 (없으면 비움)" className="h-20 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              {updateError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{updateError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditOrderId(null)} disabled={updatingOrder} className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60">취소</button>
                <button type="submit" disabled={updatingOrder} className="flex-1 rounded-xl bg-lime-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60">{updatingOrder ? "저장 중..." : "저장"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
