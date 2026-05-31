import { AdminTab, OrderStatus } from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002";

export const TABS: AdminTab[] = [
  "대시보드",
  "기본정보",
  "상품관리",
  "주문내역",
  "문의내역",
  "후기 목록",
  "계정관리",
];

export const TAB_QUERY_KEY_BY_LABEL: Record<AdminTab, string> = {
  대시보드: "dashboard",
  기본정보: "settings",
  상품관리: "products",
  주문내역: "orders",
  문의내역: "inquiries",
  "후기 목록": "reviews",
  계정관리: "accounts",
};

const TAB_LABEL_BY_QUERY_KEY: Record<string, AdminTab> = Object.entries(TAB_QUERY_KEY_BY_LABEL).reduce(
  (acc, [label, key]) => {
    acc[key] = label as AdminTab;
    return acc;
  },
  {} as Record<string, AdminTab>,
);

export function parseTabFromQueryKey(value: string | null): AdminTab | null {
  if (!value) {
    return null;
  }

  return TAB_LABEL_BY_QUERY_KEY[value] ?? null;
}

export const STATUS_OPTIONS: OrderStatus[] = ["접수", "준비중", "배송중", "배송완료", "취소"];

const KRW = new Intl.NumberFormat("ko-KR");

export function formatCurrency(value: number): string {
  return `${KRW.format(value)}원`;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    if (digits.startsWith("02")) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return value;
}
