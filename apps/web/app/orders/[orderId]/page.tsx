"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency, formatPhone } from "../../_lib/format";

type Order = {
  id: string;
  status: "접수" | "준비중" | "배송중" | "배송완료" | "취소";
  totalAmount: number;
  depositorName: string;
  phone: string;
  createdAt: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002";
const STATUS_FLOW: Order["status"][] = ["접수", "준비중", "배송중", "배송완료"];

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = useMemo(() => {
    const raw = params.orderId;
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  }, [params.orderId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setError("주문번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderId)}`);

        if (!response.ok) {
          const body = (await response.json()) as { message?: string };
          throw new Error(body.message ?? "주문 내역 조회에 실패했습니다.");
        }

        setOrder((await response.json()) as Order);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "조회 실패");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [orderId]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-4 py-6">
      <Link href="/orders" className="text-sm font-semibold text-amber-700">
        ← 주문내역으로
      </Link>

      <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow">
        <h1 className="font-display text-3xl text-amber-800">주문 상세</h1>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-sm text-stone-600">주문번호: {orderId}</p>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(orderId);
              setCopyDone(true);
              setTimeout(() => setCopyDone(false), 1500);
            }}
            className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-800"
          >
            {copyDone ? "복사됨" : "주문번호 복사"}
          </button>
        </div>

        {loading && <p className="mt-3 text-sm text-stone-600">조회 중...</p>}
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {order && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-stone-200 p-4">
              <p className="text-sm text-stone-700">입금자명: {order.depositorName}</p>
              <p className="text-sm text-stone-700">연락처: {formatPhone(order.phone)}</p>
              <p className="text-sm text-stone-700">주문금액: {formatCurrency(order.totalAmount)}</p>
              <p className="mt-2 text-sm text-stone-500">주문일시: {new Date(order.createdAt).toLocaleString()}</p>
            </div>

            <div className="rounded-2xl border border-lime-200 bg-lime-50 p-4">
              <p className="text-sm font-bold text-lime-900">배송 상태</p>
              <div className="mt-2 flex items-center gap-1 overflow-x-auto">
                {STATUS_FLOW.map((step) => {
                  const currentIndex = STATUS_FLOW.indexOf(order.status);
                  const stepIndex = STATUS_FLOW.indexOf(step);
                  const done = order.status === "취소" ? false : stepIndex <= currentIndex;
                  return (
                    <span
                      key={step}
                      className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${
                        done ? "bg-lime-200 text-lime-900" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {step}
                    </span>
                  );
                })}
                {order.status === "취소" && (
                  <span className="whitespace-nowrap rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700">
                    취소
                  </span>
                )}
              </div>
              <p className="mt-3 text-base font-bold text-lime-800">현재 상태: {order.status}</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
