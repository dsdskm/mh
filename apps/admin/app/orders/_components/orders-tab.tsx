import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatPhone, STATUS_OPTIONS, getOrderStatusLabelKo } from "../../_lib/constants";
import { AdminOrderCreatePayload, AdminOrderUpdatePayload, AdminUser, Order, OrderStatus, Product } from "../../_lib/types";
import { sendAdminSmsApi } from "../../_lib/api-messages";
import { ORDER_STATUS, ORDER_STATUS_FLOW } from "@repo/shared-types/order";
import { PaginationControls } from "../../_components/pagination-controls";
import { usePersistedPagination } from "../../_hooks/use-persisted-pagination";

type DatePreset = "today" | "week" | "month1" | "month3" | "month6" | "year1" | "all" | "custom";

const VIEW_MODE_STORAGE_KEY = "admin:orders:viewMode";
const ORDERS_FILTER_STORAGE_KEY = "admin:orders:filters";
const DIRECT_SMS_MAX_CHARS = 45;

type OrdersFilterState = {
  searchQuery: string;
  statusFilter: "all" | OrderStatus;
  startDate: string;
  endDate: string;
  datePreset: DatePreset;
};

function smsCharLength(content: string): number {
  return Array.from(content).length;
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toCsvCell(value: string | number): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(fileName: string, rows: Array<Array<string | number>>): void {
  const csv = rows.map((row) => row.map((cell) => toCsvCell(cell)).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
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
  accounts: AdminUser[];
  updateOrderStatus: (orderId: number, status: OrderStatus) => Promise<void>;
  createOrder: (payload: AdminOrderCreatePayload) => Promise<void>;
  updateOrder: (orderId: number, payload: AdminOrderUpdatePayload) => Promise<void>;
  deleteOrder: (orderId: number) => Promise<void>;
};

export function OrdersTab({ orders, products, accounts, updateOrderStatus, createOrder, updateOrder, deleteOrder }: Props) {
  const router = useRouter();

  const initialWeekRange = getPresetRange("week");
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    try {
      const raw = window.localStorage.getItem(ORDERS_FILTER_STORAGE_KEY);
      if (!raw) {
        return "";
      }
      const parsed = JSON.parse(raw) as Partial<OrdersFilterState>;
      return typeof parsed.searchQuery === "string" ? parsed.searchQuery : "";
    } catch {
      return "";
    }
  });
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>(() => {
    if (typeof window === "undefined") {
      return "all";
    }

    try {
      const raw = window.localStorage.getItem(ORDERS_FILTER_STORAGE_KEY);
      if (!raw) {
        return "all";
      }
      const parsed = JSON.parse(raw) as Partial<OrdersFilterState>;
      const saved = parsed.statusFilter;
      return saved === "all" || (typeof saved === "string" && STATUS_OPTIONS.includes(saved as OrderStatus))
        ? (saved as "all" | OrderStatus)
        : "all";
    } catch {
      return "all";
    }
  });
  const [startDate, setStartDate] = useState(() => {
    if (typeof window === "undefined") {
      return initialWeekRange.start;
    }

    try {
      const raw = window.localStorage.getItem(ORDERS_FILTER_STORAGE_KEY);
      if (!raw) {
        return initialWeekRange.start;
      }
      const parsed = JSON.parse(raw) as Partial<OrdersFilterState>;
      return typeof parsed.startDate === "string" ? parsed.startDate : initialWeekRange.start;
    } catch {
      return initialWeekRange.start;
    }
  });
  const [endDate, setEndDate] = useState(() => {
    if (typeof window === "undefined") {
      return initialWeekRange.end;
    }

    try {
      const raw = window.localStorage.getItem(ORDERS_FILTER_STORAGE_KEY);
      if (!raw) {
        return initialWeekRange.end;
      }
      const parsed = JSON.parse(raw) as Partial<OrdersFilterState>;
      return typeof parsed.endDate === "string" ? parsed.endDate : initialWeekRange.end;
    } catch {
      return initialWeekRange.end;
    }
  });
  const [datePreset, setDatePreset] = useState<DatePreset>(() => {
    if (typeof window === "undefined") {
      return "week";
    }

    try {
      const raw = window.localStorage.getItem(ORDERS_FILTER_STORAGE_KEY);
      if (!raw) {
        return "week";
      }
      const parsed = JSON.parse(raw) as Partial<OrdersFilterState>;
      const saved = parsed.datePreset;
      return saved === "today" || saved === "week" || saved === "month1" || saved === "month3" || saved === "month6" || saved === "year1" || saved === "all" || saved === "custom"
        ? saved
        : "week";
    } catch {
      return "week";
    }
  });
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [pendingStatusByOrderId, setPendingStatusByOrderId] = useState<Record<number, OrderStatus>>({});
  const [confirmState, setConfirmState] = useState<{
    orderId: number;
    currentStatus: OrderStatus;
    nextStatus: OrderStatus;
  } | null>(null);
  const [submittingOrderId, setSubmittingOrderId] = useState<number | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createPurchaseType, setCreatePurchaseType] = useState<"member" | "guest">("member");
  const [createAccountId, setCreateAccountId] = useState<string>("");
  const [createCustomerName, setCreateCustomerName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createRecipientPhone, setCreateRecipientPhone] = useState("");
  const [createDepositorName, setCreateDepositorName] = useState("");
  const [createShippingAddress, setCreateShippingAddress] = useState("");
  const [createRequestNote, setCreateRequestNote] = useState("");
  const [createQuantities, setCreateQuantities] = useState<Record<number, string>>({});

  const [smsTarget, setSmsTarget] = useState<Order | null>(null);
  const [smsMessage, setSmsMessage] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsConfirmOpen, setSmsConfirmOpen] = useState(false);

  const [editOrderId, setEditOrderId] = useState<number | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRecipientPhone, setEditRecipientPhone] = useState("");
  const [editDepositorName, setEditDepositorName] = useState("");
  const [editShippingAddress, setEditShippingAddress] = useState("");
  const [editRequestNote, setEditRequestNote] = useState("");
  const [editCancelReason, setEditCancelReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null);

  const [viewMode, setViewMode] = useState<"basic" | "simple" | "calendar">(() => {
    if (typeof window === "undefined") {
      return "basic";
    }
    const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return saved === "simple" || saved === "calendar" ? saved : "basic";
  });
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dayPopup, setDayPopup] = useState<{ label: string; orders: Order[] } | null>(null);

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

  // 뷰 모드 선택을 새로고침 후에도 유지
  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  // 필터 선택을 새로고침 후에도 유지
  useEffect(() => {
    const next: OrdersFilterState = {
      searchQuery,
      statusFilter,
      startDate,
      endDate,
      datePreset,
    };
    window.localStorage.setItem(ORDERS_FILTER_STORAGE_KEY, JSON.stringify(next));
  }, [searchQuery, statusFilter, startDate, endDate, datePreset]);

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
        String(order.id),
        order.customerName,
        order.depositorName,
        order.phone,
        order.recipientPhone,
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

  const selectableAccounts = useMemo(() => {
    return accounts
      .filter((account) => account.status === "active")
      .slice()
      .sort((a, b) => {
        const nameA = a.displayName ?? a.username ?? a.userId ?? "";
        const nameB = b.displayName ?? b.username ?? b.userId ?? "";
        return nameA.localeCompare(nameB, "ko");
      });
  }, [accounts]);

  function getAccountLabel(account: AdminUser): string {
    const name = account.displayName ?? account.username ?? account.userId ?? `계정 #${account.id}`;
    return account.phone ? `${name} (${formatPhone(account.phone)})` : name;
  }

  function handleSelectAccount(accountIdValue: string) {
    setCreateAccountId(accountIdValue);

    const account = accounts.find((item) => String(item.id) === accountIdValue);
    if (!account) {
      return;
    }

    const name = account.displayName ?? account.username ?? account.userId ?? "";
    const address = [account.address1, account.address2].filter(Boolean).join(" ").trim();

    setCreateCustomerName(name);
    setCreatePhone(account.phone ?? "");
    setCreateRecipientPhone(account.phone ?? "");
    setCreateDepositorName(name);
    setCreateShippingAddress(address);
  }

  function getPendingStatus(order: Order): OrderStatus {
    return pendingStatusByOrderId[order.id] ?? order.status;
  }

  function setPendingStatus(orderId: number, status: OrderStatus) {
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
    setCreatePurchaseType("member");
    setCreateAccountId("");
    setCreateCustomerName("");
    setCreatePhone("");
    setCreateRecipientPhone("");
    setCreateDepositorName("");
    setCreateShippingAddress("");
    setCreateRequestNote("");
    setCreateQuantities({});
    setCreateError(null);
  }

  function changePurchaseType(nextType: "member" | "guest") {
    setCreatePurchaseType(nextType);
    setCreateAccountId("");
    setCreateCustomerName("");
    setCreatePhone("");
    setCreateRecipientPhone("");
    setCreateDepositorName("");
    setCreateShippingAddress("");
    setCreateError(null);
  }

  function openSmsModal(order: Order) {
    setSmsTarget(order);
    setSmsMessage("");
    setSmsError(null);
    setSmsConfirmOpen(false);
  }

  function closeSmsModal() {
    setSmsTarget(null);
    setSmsConfirmOpen(false);
  }

  function submitSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!smsTarget) {
      return;
    }

    const content = smsMessage.trim();
    if (!content) {
      setSmsError("메시지를 입력해주세요.");
      return;
    }

    if (smsCharLength(content) > DIRECT_SMS_MAX_CHARS) {
      setSmsError(`메시지는 ${DIRECT_SMS_MAX_CHARS}자 이하로 입력해주세요.`);
      return;
    }

    setSmsConfirmOpen(true);
  }

  async function confirmSmsSend() {
    if (!smsTarget) {
      return;
    }

    const content = smsMessage.trim();
    if (!content) {
      setSmsError("메시지를 입력해주세요.");
      setSmsConfirmOpen(false);
      return;
    }

    setSmsSending(true);
    setSmsError(null);
    try {
      await sendAdminSmsApi({
        receiver: smsTarget.phone,
        receiverName: smsTarget.customerName,
        content,
      });
      closeSmsModal();
      setSmsMessage("");
    } catch (error) {
      setSmsError(error instanceof Error ? error.message : "발송에 실패했습니다.");
      setSmsConfirmOpen(false);
    } finally {
      setSmsSending(false);
    }
  }

  function openEditModal(order: Order) {
    setEditOrderId(order.id);
    setEditCustomerName(order.customerName);
    setEditPhone(order.phone);
    setEditRecipientPhone(order.recipientPhone);
    setEditDepositorName(order.depositorName);
    setEditShippingAddress(order.shippingAddress);
    setEditRequestNote(order.requestNote ?? "");
    setEditCancelReason(order.cancelReason ?? "");
    setUpdateError(null);
  }

  function requestDeleteOrder(order: Order) {
    setDeleteTarget(order);
    setDeleteError(null);
  }

  async function confirmDeleteOrder() {
    if (!deleteTarget) {
      return;
    }

    setDeletingOrderId(deleteTarget.id);
    setDeleteError(null);
    try {
      await deleteOrder(deleteTarget.id);
      router.refresh();
      setDetailOrderId((prev) => (prev === String(deleteTarget.id) ? null : prev));
      setEditOrderId((prev) => (prev === deleteTarget.id ? null : prev));
      setDayPopup((prev) => {
        if (!prev) {
          return prev;
        }

        const nextOrders = prev.orders.filter((order) => order.id !== deleteTarget.id);
        return nextOrders.length > 0 ? { ...prev, orders: nextOrders } : null;
      });
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "주문 삭제에 실패했습니다.");
    } finally {
      setDeletingOrderId(null);
    }
  }

  async function submitCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);

    if (createPurchaseType === "member" && !createAccountId) {
      setCreateError("회원 주문은 주문자 계정을 선택해주세요.");
      return;
    }

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
        recipientPhone: createRecipientPhone.trim(),
        depositorName: createDepositorName.trim(),
        shippingAddress: createShippingAddress.trim(),
        requestNote: createRequestNote.trim() || undefined,
        purchaseType: createPurchaseType,
        accountId: createPurchaseType === "member" ? Number(createAccountId) : null,
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
        recipientPhone: editRecipientPhone.trim(),
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

  function renderStatusHistory(order: Order) {
    if (!order.statusHistory?.length) {
      return null;
    }

    const atByStatus = new Map<string, string>();
    for (const entry of order.statusHistory) {
      if (!atByStatus.has(entry.status)) {
        atByStatus.set(entry.status, entry.at);
      }
    }

    // 전체 흐름을 항상 표시하고, 처리되지 않은 단계는 흐릿하게 표시
    const steps: { status: OrderStatus; at: string | null; done: boolean }[] =
      ORDER_STATUS_FLOW.map((status) => ({
        status,
        at: atByStatus.get(status) ?? null,
        done: atByStatus.has(status),
      }));
    // 취소 단계는 정방향 흐름에 없으므로 이력에 있으면 뒤에 추가
    for (const cancelStatus of [ORDER_STATUS.CANCEL_REQUESTED, ORDER_STATUS.CANCEL_COMPLETED]) {
      if (atByStatus.has(cancelStatus)) {
        steps.push({ status: cancelStatus, at: atByStatus.get(cancelStatus)!, done: true });
      }
    }

    return (
      <div className="mb-4 rounded-xl bg-stone-50 p-3">
        <p className="text-xs font-semibold text-stone-500">상태 처리 이력</p>
        <ol className="mt-2 flex items-start gap-1 overflow-x-auto pb-1">
          {steps.map((step, idx) => {
            const d = step.at ? new Date(step.at) : null;
            return (
              <li key={`${order.id}-h${idx}`} className="flex items-start gap-1">
                <div className={`flex min-w-[88px] flex-col items-center text-center ${step.done ? "" : "opacity-40"}`}>
                  <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                    step.done ? getStatusBadgeClass(step.status) : "border-stone-200 bg-stone-100 text-stone-400"
                  }`}>
                    {getOrderStatusLabelKo(step.status)}
                  </span>
                  <span className="mt-1 text-[10px] leading-tight text-stone-500">
                    {d ? (
                      <>
                        {d.toLocaleDateString()}
                        <br />
                        {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </>
                    ) : (
                      "-"
                    )}
                  </span>
                </div>
                {idx < steps.length - 1 && <span className="mt-1.5 shrink-0 text-stone-400">→</span>}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  // 캘린더 뷰: 검색·상태 필터는 적용하되 날짜범위/페이지는 무시하고 월 단위로 봅니다.
  const calendarOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        String(order.id),
        order.customerName,
        order.depositorName,
        order.phone,
        order.recipientPhone,
        ...order.items.map((item) => item.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [orders, searchQuery, statusFilter]);

  const ordersByDay = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const order of calendarOrders) {
      const d = new Date(order.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(order);
      map.set(key, arr);
    }
    return map;
  }, [calendarOrders]);

  const calendarWeeks = useMemo(() => {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const startWeekday = new Date(year, month, 1).getDay();
    const weeks: Date[][] = [];
    for (let w = 0; w < 6; w += 1) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d += 1) {
        week.push(new Date(year, month, 1 - startWeekday + w * 7 + d));
      }
      weeks.push(week);
    }
    return weeks;
  }, [calendarCursor]);

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

      <div className="mt-4 inline-flex rounded-xl border border-stone-200 bg-white p-1">
        {([
          { key: "basic", label: "기본" },
          { key: "simple", label: "요약" },
          { key: "calendar", label: "캘린더" },
        ] as const).map((mode) => (
          <button
            key={mode.key}
            type="button"
            onClick={() => setViewMode(mode.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              viewMode === mode.key ? "bg-lime-600 text-white" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="주문번호·받는분·연락처·상품명 검색"
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
            const exportedRows: Array<Array<string | number>> = [
              ["주문번호", "일시", "받는분", "주문자 연락처", "받는분 연락처", "배송지", "주문자", "품목", "금액", "상태"],
              ...filteredOrders.map((order) => [
                order.id,
                new Date(order.createdAt).toLocaleString(),
                order.customerName,
                formatPhone(order.phone),
                formatPhone(order.recipientPhone),
                order.shippingAddress,
                order.depositorName,
                order.items.map((item) => `${item.name} x${item.quantity}`).join(", "),
                order.totalAmount,
                getOrderStatusLabelKo(order.status),
              ]),
            ];

            const periodLabel = (() => {
              if (startDate && endDate) {
                return `${startDate}_${endDate}`;
              }
              if (startDate) {
                return `${startDate}_from`;
              }
              if (endDate) {
                return `${endDate}_until`;
              }
              return "all";
            })();

            downloadCsv(`주문내역_${periodLabel}.csv`, exportedRows);
          }}
          className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          엑셀 다운로드
        </button>
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

      {viewMode === "basic" && (
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
              {renderStatusHistory(order)}
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
                    <p>받는분: {order.customerName}</p>
                    <p>주문자 연락처: {formatPhone(order.phone)}</p>
                    <p>받는분 연락처: {formatPhone(order.recipientPhone)}</p>
                    <p>주문자: {order.depositorName}</p>
                    {order.deliveryFee > 0 && <p>배송료: {formatCurrency(order.deliveryFee)}</p>}
                    {order.couponDiscount > 0 && <p>쿠폰 할인: -{formatCurrency(order.couponDiscount)}</p>}
                    {order.mileageUsed > 0 && <p>적립금 사용: -{formatCurrency(order.mileageUsed)}</p>}
                    {order.mileageEarned > 0 && <p>적립금 적립: {formatCurrency(order.mileageEarned)}</p>}
                    <p className="font-semibold text-amber-700">주문금액: {formatCurrency(order.totalAmount)}</p>
                    {order.paymentDueAt && order.status === ORDER_STATUS.RECEIVED && (
                      <p className="font-semibold text-rose-700 sm:col-span-2">
                        입금기한: {new Date(order.paymentDueAt).toLocaleString()} 까지
                      </p>
                    )}
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
                    <button
                      type="button"
                      onClick={() => openSmsModal(order)}
                      className="w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700"
                    >
                      문자 전송
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDeleteOrder(order)}
                      disabled={deletingOrderId === order.id}
                      className="w-full rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                    >
                      {deletingOrderId === order.id ? "삭제 중..." : "주문 삭제"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      )}

      {viewMode === "simple" && (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs font-semibold text-stone-600">
              <tr>
                <th className="px-3 py-2 text-left">주문번호</th>
                <th className="px-3 py-2 text-left">일시</th>
                <th className="px-3 py-2 text-left">받는분</th>
                <th className="px-3 py-2 text-left">품목</th>
                <th className="px-3 py-2 text-right">금액</th>
                <th className="px-3 py-2 text-left">상태</th>
                <th className="px-3 py-2 text-left">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-stone-400">조건에 맞는 주문이 없습니다.</td>
                </tr>
              )}
              {paginatedOrders.map((order) => {
                const pendingStatus = getPendingStatus(order);
                const statusChanged = pendingStatus !== order.status;

                return (
                  <tr key={order.id} className="align-top hover:bg-stone-50">
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-stone-900">{order.id}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-stone-500">{new Date(order.createdAt).toLocaleString()}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-stone-800">{order.customerName}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          order.purchaseType === "member" ? "bg-sky-100 text-sky-800" : "bg-stone-200 text-stone-700"
                        }`}>
                          {order.purchaseType === "member" ? "회원" : "비회원"}
                        </span>
                      </div>
                      <span className="block text-xs text-stone-500">주문자 {formatPhone(order.phone)}</span>
                      <span className="block text-xs text-stone-500">수신자 {formatPhone(order.recipientPhone)}</span>
                    </td>
                    <td className="max-w-[320px] px-3 py-2 text-stone-700">
                      <span className="block truncate">{order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-amber-700">{formatCurrency(order.totalAmount)}</td>
                    <td className="px-3 py-2">
                      <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${getStatusBadgeClass(order.status)}`}>
                        {getOrderStatusLabelKo(order.status)}
                      </span>
                    </td>
                    <td className="min-w-[260px] px-3 py-2">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <select
                            value={pendingStatus}
                            onChange={(event) => setPendingStatus(order.id, event.target.value as OrderStatus)}
                            aria-label="주문 상태 변경"
                            className="rounded-lg border border-stone-300 px-2 py-1 text-xs"
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>{getOrderStatusLabelKo(status)}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!statusChanged || submittingOrderId === order.id}
                            onClick={() => {
                              setConfirmState({ orderId: order.id, currentStatus: order.status, nextStatus: pendingStatus });
                              setConfirmError(null);
                            }}
                            className="rounded-lg bg-lime-600 px-2 py-1 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            변경
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditModal(order)}
                            className="rounded-lg border border-stone-300 px-2 py-1 text-xs font-semibold text-stone-700"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => openSmsModal(order)}
                            className="rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700"
                          >
                            문자
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteOrder(order)}
                            disabled={deletingOrderId === order.id}
                            className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-60"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === "calendar" && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setCalendarCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-700"
            >
              ←
            </button>
            <p className="text-lg font-bold text-stone-900">
              {calendarCursor.getFullYear()}년 {calendarCursor.getMonth() + 1}월
            </p>
            <button
              type="button"
              onClick={() => setCalendarCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-700"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCalendarCursor(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700"
            >
              오늘
            </button>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-stone-200 bg-stone-200">
            {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
              <div key={label} className="bg-stone-50 py-2 text-center text-xs font-bold text-stone-600">{label}</div>
            ))}
            {calendarWeeks.flat().map((day) => {
              const inMonth = day.getMonth() === calendarCursor.getMonth();
              const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
              const dayOrders = ordersByDay.get(key) ?? [];
              const dayTotal = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);

              return (
                <div
                  key={key}
                  onClick={
                    dayOrders.length > 0
                      ? () =>
                          setDayPopup({
                            label: `${day.getFullYear()}년 ${day.getMonth() + 1}월 ${day.getDate()}일`,
                            orders: dayOrders,
                          })
                      : undefined
                  }
                  className={`min-h-[112px] p-1.5 ${inMonth ? "bg-white" : "bg-stone-50"} ${
                    dayOrders.length > 0 ? "cursor-pointer hover:bg-lime-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${inMonth ? "text-stone-700" : "text-stone-400"}`}>{day.getDate()}</span>
                    {dayOrders.length > 0 && (
                      <span className="rounded-full bg-lime-100 px-1.5 py-0.5 text-[10px] font-bold text-lime-800">{dayOrders.length}</span>
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {dayOrders.slice(0, 3).map((o) => (
                      <div
                        key={o.id}
                        title={`${o.customerName}(${getOrderStatusLabelKo(o.status)}) · ${formatCurrency(o.totalAmount)}`}
                        className="w-full truncate rounded bg-stone-100 px-1 py-0.5 text-[11px] text-stone-700"
                      >
                        {o.customerName}({getOrderStatusLabelKo(o.status)})
                      </div>
                    ))}
                    {dayOrders.length > 3 && (
                      <p className="text-[10px] font-semibold text-lime-700">+{dayOrders.length - 3}건 더보기</p>
                    )}
                  </div>
                  {dayOrders.length > 0 && (
                    <p className="mt-1 text-right text-[10px] font-semibold text-amber-700">{formatCurrency(dayTotal)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode !== "calendar" && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredOrders.length}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageSizeChange={setPageSize}
          onPageChange={setCurrentPage}
        />
      )}

      {dayPopup && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-stone-900">{dayPopup.label} 주문 ({dayPopup.orders.length}건)</h3>
              <button
                type="button"
                onClick={() => setDayPopup(null)}
                className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-600"
              >
                닫기
              </button>
            </div>
            <ul className="mt-4 space-y-3 overflow-y-auto pr-1">
              {dayPopup.orders.map((o) => (
                <li key={o.id} className="space-y-2 rounded-2xl border border-stone-200 bg-white p-3 text-sm">
                  {renderStatusHistory(o)}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-stone-900">주문번호 {o.id}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        o.purchaseType === "member" ? "bg-sky-100 text-sky-800" : "bg-stone-200 text-stone-700"
                      }`}>
                        {o.purchaseType === "member" ? "회원" : "비회원"}
                      </span>
                    </div>
                    <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${getStatusBadgeClass(o.status)}`}>
                      {getOrderStatusLabelKo(o.status)}
                    </span>
                  </div>

                  <p className="text-xs text-stone-500">{new Date(o.createdAt).toLocaleString()}</p>

                  <div className="grid gap-x-3 gap-y-0.5 text-stone-700 sm:grid-cols-2">
                    <p>받는분: {o.customerName}</p>
                    <p>주문자 연락처: {formatPhone(o.phone)}</p>
                    <p>받는분 연락처: {formatPhone(o.recipientPhone)}</p>
                    <p>주문자: {o.depositorName}</p>
                    {o.deliveryFee > 0 && <p>배송료: {formatCurrency(o.deliveryFee)}</p>}
                    {o.couponDiscount > 0 && <p>쿠폰 할인: -{formatCurrency(o.couponDiscount)}</p>}
                    {o.mileageUsed > 0 && <p>적립금 사용: -{formatCurrency(o.mileageUsed)}</p>}
                    {o.mileageEarned > 0 && <p>적립금 적립: {formatCurrency(o.mileageEarned)}</p>}
                    <p className="font-semibold text-amber-700">주문금액: {formatCurrency(o.totalAmount)}</p>
                  </div>

                  {o.paymentDueAt && o.status === ORDER_STATUS.RECEIVED && (
                    <p className="font-semibold text-rose-700">입금기한: {new Date(o.paymentDueAt).toLocaleString()} 까지</p>
                  )}

                  <p className="text-stone-700">
                    <span className="text-xs font-semibold text-stone-500">배송지 </span>
                    {o.shippingAddress}
                  </p>
                  <p className="text-stone-700">
                    <span className="text-xs font-semibold text-stone-500">요청사항 </span>
                    {o.requestNote?.trim() ? o.requestNote : "없음"}
                  </p>

                  {o.cancelReason?.trim() && (
                    <p className="text-red-700">
                      <span className="text-xs font-semibold text-red-600">취소 사유 </span>
                      {o.cancelReason}
                    </p>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-stone-500">주문 품목</p>
                    <ul className="mt-1 space-y-0.5 text-stone-700">
                      {o.items.map((item) => (
                        <li key={`${o.id}-${item.productId}`} className="flex items-center justify-between gap-2">
                          <span>{item.name} x {item.quantity}</span>
                          <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {confirmState && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
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

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[82] flex items-center justify-center bg-black/40 p-4"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-bold text-stone-900">주문 삭제 확인</h3>
            <p className="mt-2 text-sm text-stone-700">주문번호 {deleteTarget.id}을(를) 삭제할까요?</p>
            <p className="mt-1 text-xs text-stone-500">취소 완료 전 주문은 삭제 시 재고와 사용 혜택이 복구됩니다.</p>
            {deleteError && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {deleteError}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingOrderId)}
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteOrder()}
                disabled={Boolean(deletingOrderId)}
                className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {deletingOrderId ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4"
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-stone-900">주문 추가</h3>
            <form onSubmit={submitCreateOrder} className="mt-4 space-y-3">
              <div className="flex gap-2">
                {([
                  { key: "member", label: "회원 주문" },
                  { key: "guest", label: "비회원 주문" },
                ] as const).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => changePurchaseType(option.key)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      createPurchaseType === option.key
                        ? "border-lime-600 bg-lime-600 text-white"
                        : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {createPurchaseType === "member" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-600">주문자 계정</label>
                  <select
                    value={createAccountId}
                    onChange={(e) => handleSelectAccount(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">계정을 선택하세요</option>
                    {selectableAccounts.map((account) => (
                      <option key={account.id} value={account.id}>{getAccountLabel(account)}</option>
                    ))}
                  </select>
                  {selectableAccounts.length === 0 && (
                    <p className="mt-1 text-[11px] text-stone-500">선택 가능한 활성 계정이 없습니다.</p>
                  )}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <input value={createCustomerName} onChange={(e) => setCreateCustomerName(e.target.value)} placeholder="받는분" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
                <input value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} placeholder="주문자 연락처" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
                <input value={createRecipientPhone} onChange={(e) => setCreateRecipientPhone(e.target.value)} placeholder="수신자 연락처" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
                <input value={createDepositorName} onChange={(e) => setCreateDepositorName(e.target.value)} placeholder="주문자" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
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

      {smsTarget && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4"
        >
          <div
            className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-stone-900">문자 전송</h3>
            <p className="mt-1 text-sm text-stone-500">주문번호 {smsTarget.id}</p>
            <form onSubmit={submitSms} className="mt-4 space-y-3">
              <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                <p className="text-xs font-semibold text-stone-500">받는 사람</p>
                <p className="mt-1">{smsTarget.customerName} · {formatPhone(smsTarget.phone)}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-600">메시지</label>
                <textarea
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  maxLength={DIRECT_SMS_MAX_CHARS}
                  placeholder="전송할 메시지를 입력하세요."
                  className="h-32 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-right text-xs text-stone-500">
                  {smsCharLength(smsMessage)} / {DIRECT_SMS_MAX_CHARS}자
                </p>
              </div>
              {smsError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{smsError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!smsSending) {
                      closeSmsModal();
                    }
                  }}
                  disabled={smsSending}
                  className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={smsSending}
                  className="flex-1 rounded-xl bg-sky-600 px-3 py-2 text-sm font-bold text-white"
                >
                  전송
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {smsTarget && smsConfirmOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">문자 전송 확인</h3>
            <p className="mt-2 text-sm text-stone-700">
              {smsTarget.customerName} ({formatPhone(smsTarget.phone)}) 님에게 문자를 전송할까요?
            </p>
            <p className="mt-2 line-clamp-4 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
              {smsMessage.trim()}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSmsConfirmOpen(false)}
                disabled={smsSending}
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmSmsSend()}
                disabled={smsSending}
                className="flex-1 rounded-xl bg-sky-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {smsSending ? "전송 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editOrderId && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4"
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-stone-900">주문 정보 수정</h3>
            <form onSubmit={submitUpdateOrder} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} placeholder="받는분" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="주문자 연락처" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
                <input value={editRecipientPhone} onChange={(e) => setEditRecipientPhone(e.target.value)} placeholder="받는분 연락처" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
                <input value={editDepositorName} onChange={(e) => setEditDepositorName(e.target.value)} placeholder="주문자" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
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
