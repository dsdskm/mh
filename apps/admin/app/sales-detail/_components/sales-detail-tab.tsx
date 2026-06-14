import { useMemo, useState } from "react";
import { formatCurrency, getOrderStatusLabelKo, STATUS_OPTIONS } from "../../_lib/constants";
import { Order, OrderStatus } from "../../_lib/types";
import { ORDER_STATUS } from "@repo/shared-types/order";
import { PaginationControls } from "../../_components/pagination-controls";
import { usePersistedPagination } from "../../_hooks/use-persisted-pagination";

type DatePreset = "today" | "week" | "month1" | "month3" | "month6" | "year1" | "all" | "custom";

type Props = {
  orders: Order[];
};

type SalesRow = {
  orderId: string;
  customerName: string;
  status: OrderStatus;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  createdAt: string;
};

function getSalesFactor(status: OrderStatus): 0 | 1 {
  return status === ORDER_STATUS.CANCEL_COMPLETED ? 0 : 1;
}

function getEffectiveSubtotal(row: SalesRow): number {
  return row.subtotal * getSalesFactor(row.status);
}

function getEffectiveQuantity(row: SalesRow): number {
  return row.quantity * getSalesFactor(row.status);
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

export function SalesDetailTab({ orders }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [sortBy, setSortBy] = useState<"orderId" | "subtotal">("orderId");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const initialWeekRange = getPresetRange("week");
  const [startDate, setStartDate] = useState(initialWeekRange.start);
  const [endDate, setEndDate] = useState(initialWeekRange.end);
  const [datePreset, setDatePreset] = useState<DatePreset>("week");

  const rows = useMemo<SalesRow[]>(() => {
    return orders.flatMap((order) =>
      order.items.map((item) => ({
        orderId: order.id,
        customerName: order.customerName,
        status: order.status,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        createdAt: order.createdAt,
      })),
    );
  }, [orders]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const startAt = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endAt = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null;

    return rows
      .filter((row) => {
        if (row.status === ORDER_STATUS.RECEIVED) {
          return false;
        }

        if (statusFilter !== "all" && row.status !== statusFilter) {
          return false;
        }

        const createdAt = new Date(row.createdAt).getTime();
        if (startAt !== null && createdAt < startAt) {
          return false;
        }
        if (endAt !== null && createdAt > endAt) {
          return false;
        }

        if (!q) {
          return true;
        }

        const haystack = [row.orderId, row.customerName, row.productName].join(" ").toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rows, searchQuery, statusFilter, startDate, endDate]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (sortBy === "subtotal") {
        const aSubtotal = getEffectiveSubtotal(a);
        const bSubtotal = getEffectiveSubtotal(b);

        if (aSubtotal === bSubtotal) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }

        return sortDirection === "asc" ? aSubtotal - bSubtotal : bSubtotal - aSubtotal;
      }

      const byOrderId = a.orderId.localeCompare(b.orderId, "ko", { numeric: true, sensitivity: "base" });
      if (byOrderId !== 0) {
        return sortDirection === "asc" ? byOrderId : -byOrderId;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredRows, sortBy, sortDirection]);

  const { currentPage, setCurrentPage, totalPages, pageSize, setPageSize, pageSizeOptions, startIndex, endIndex } = usePersistedPagination({
    storageKey: "admin:pagination:sales-detail",
    totalItems: sortedRows.length,
    pageSizeOptions: [20, 50, 100],
    resetDeps: [searchQuery, statusFilter, startDate, endDate, sortBy, sortDirection],
  });

  const paginatedRows = sortedRows.slice(startIndex, endIndex);

  const summary = useMemo(() => {
    const totalSales = filteredRows.reduce((sum, row) => sum + getEffectiveSubtotal(row), 0);
    const totalQuantity = filteredRows.reduce((sum, row) => sum + getEffectiveQuantity(row), 0);
    const uniqueOrderCount = new Set(filteredRows.map((row) => row.orderId)).size;
    const uniqueCustomerCount = new Set(filteredRows.map((row) => row.customerName.trim())).size;

    return {
      totalSales,
      totalQuantity,
      uniqueOrderCount,
      uniqueCustomerCount,
    };
  }, [filteredRows]);

  return (
    <section className="space-y-6">
      <h2 className="font-display text-3xl text-lime-800">매출 상세</h2>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-lime-200 bg-lime-50 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-lime-700">총 매출</p>
          <p className="mt-1 text-2xl font-extrabold text-lime-900">{formatCurrency(summary.totalSales)}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-amber-700">총 판매수량</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-900">{summary.totalQuantity}개</p>
        </article>
        <article className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-sky-700">주문 건수</p>
          <p className="mt-1 text-2xl font-extrabold text-sky-900">{summary.uniqueOrderCount}건</p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-stone-500">주문자</p>
          <p className="mt-1 text-2xl font-extrabold text-stone-900">{summary.uniqueCustomerCount}명</p>
        </article>
      </section>

      <div className="flex flex-wrap gap-2">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="주문번호·고객명·상품명 검색"
          className="min-w-52 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)}
          className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
        >
          <option value="all">전체 상태</option>
          {STATUS_OPTIONS.filter((status) => status !== ORDER_STATUS.RECEIVED).map((status) => (
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
              ["주문번호", "고객명", "상태", "상품명", "수량", "단가", "소계", "주문일시"],
              ...sortedRows.map((row) => [
                row.orderId,
                row.customerName,
                getOrderStatusLabelKo(row.status),
                row.productName,
                getEffectiveQuantity(row),
                row.unitPrice,
                getEffectiveSubtotal(row),
                new Date(row.createdAt).toLocaleString(),
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

            downloadCsv(`${periodLabel}.csv`, exportedRows);
          }}
          className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          엑셀 Export
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

      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full bg-white text-sm">
          <thead className="bg-stone-50 text-xs font-semibold text-stone-600">
            <tr>
              <th className="px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => {
                    if (sortBy === "orderId") {
                      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
                      return;
                    }

                    setSortBy("orderId");
                    setSortDirection("desc");
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-stone-700 hover:text-stone-900"
                  aria-label="주문번호 정렬"
                >
                  주문번호
                  {sortBy === "orderId" && (
                    <span className="text-[10px] text-stone-500">{sortDirection === "desc" ? "▼" : "▲"}</span>
                  )}
                </button>
              </th>
              <th className="px-3 py-2 text-left">고객명</th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-left">상품명</th>
              <th className="px-3 py-2 text-left">수량</th>
              <th className="px-3 py-2 text-left">단가</th>
              <th className="px-3 py-2 text-left">
                <button
                  type="button"
                  onClick={() => {
                    if (sortBy === "subtotal") {
                      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
                      return;
                    }

                    setSortBy("subtotal");
                    setSortDirection("desc");
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-stone-700 hover:text-stone-900"
                  aria-label="소계 정렬"
                >
                  소계
                  {sortBy === "subtotal" && (
                    <span className="text-[10px] text-stone-500">{sortDirection === "desc" ? "▼" : "▲"}</span>
                  )}
                </button>
              </th>
              <th className="px-3 py-2 text-left">주문일시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-stone-400">조건에 맞는 매출 데이터가 없습니다.</td>
              </tr>
            )}
            {paginatedRows.map((row, index) => (
              <tr key={`${row.orderId}-${row.productName}-${index}`} className="hover:bg-stone-50">
                <td className="px-3 py-2 font-medium text-stone-900">{row.orderId}</td>
                <td className="px-3 py-2 text-stone-700">{row.customerName}</td>
                <td className="px-3 py-2 text-stone-600">{getOrderStatusLabelKo(row.status)}</td>
                <td className="px-3 py-2 text-stone-700">{row.productName}</td>
                <td className={`px-3 py-2 ${row.status === ORDER_STATUS.CANCEL_COMPLETED ? "text-rose-700" : "text-stone-700"}`}>
                  {getEffectiveQuantity(row)}
                </td>
                <td className="px-3 py-2 text-stone-700">{formatCurrency(row.unitPrice)}</td>
                <td
                  className={`px-3 py-2 font-semibold ${
                    row.status === ORDER_STATUS.CANCEL_COMPLETED ? "text-rose-700" : "text-amber-700"
                  }`}
                >
                  {formatCurrency(getEffectiveSubtotal(row))}
                </td>
                <td className="px-3 py-2 text-xs text-stone-500">{new Date(row.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={sortedRows.length}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={setPageSize}
        onPageChange={setCurrentPage}
      />
    </section>
  );
}
