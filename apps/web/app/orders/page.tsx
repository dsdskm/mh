"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";
import { formatCurrency, formatPhone } from "../_lib/format";

type Order = {
  id: string;
  status: "접수" | "준비중" | "배송중" | "배송완료" | "취소";
  totalAmount: number;
  depositorName: string;
  phone: string;
  createdAt: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002";
const MEMBER_PHONE_KEY = "cornmarket:member-phone";
const STATUS_FLOW: Order["status"][] = ["접수", "준비중", "배송중", "배송완료"];

export default function OrdersPage() {
  const router = useRouter();
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  const [guestOrderId, setGuestOrderId] = useState("");

  const [memberPhone, setMemberPhone] = useState("");
  const [memberOrders, setMemberOrders] = useState<Order[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const savedPhone = localStorage.getItem(MEMBER_PHONE_KEY) ?? "";
    setMemberPhone(savedPhone);

    if (!savedPhone) {
      setMemberError("회원 주문 연락처가 없어 자동 조회할 수 없어요. 연락처를 입력해 주세요.");
      return;
    }

    void loadMemberOrders(savedPhone);
  }, [isLoggedIn]);

  async function loadMemberOrders(phone: string) {
    setMemberLoading(true);
    setMemberError(null);
    setMemberOrders([]);

    try {
      const response = await fetch(`${API_BASE}/api/orders?phone=${encodeURIComponent(phone)}`);

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "주문 내역 조회에 실패했습니다.");
      }

      setMemberOrders((await response.json()) as Order[]);
    } catch (fetchError) {
      setMemberError(fetchError instanceof Error ? fetchError.message : "조회 실패");
    } finally {
      setMemberLoading(false);
    }
  }

  function submitGuestLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextId = guestOrderId.trim();
    if (!nextId) {
      return;
    }
    router.push(`/orders/${encodeURIComponent(nextId)}`);
  }

  async function submitMemberLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!memberPhone.trim()) {
      setMemberError("연락처를 입력해주세요.");
      return;
    }

    localStorage.setItem(MEMBER_PHONE_KEY, memberPhone.trim());
    await loadMemberOrders(memberPhone.trim());
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-4 py-6">
      <Link href="/" className="text-sm font-semibold text-amber-700">
        ← 홈으로
      </Link>

      <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow">
        <h1 className="font-display text-3xl text-amber-800">주문내역 조회</h1>
        {isLoggedIn ? (
          <p className="mt-1 text-sm text-stone-600">로그인된 회원 주문내역을 바로 보여드려요.</p>
        ) : (
          <p className="mt-1 text-sm text-stone-600">비회원은 주문번호로 간단히 확인할 수 있어요.</p>
        )}

        {isLoggedIn ? (
          <form className="mt-4 space-y-3" onSubmit={submitMemberLookup}>
            <input
              value={memberPhone}
              onChange={(event) => setMemberPhone(event.target.value)}
              placeholder="회원 주문 연락처"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              disabled={memberLoading}
              className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {memberLoading ? "조회 중..." : "내 주문내역 다시 조회"}
            </button>
          </form>
        ) : (
          <>
            <form className="mt-4 space-y-3" onSubmit={submitGuestLookup}>
              <input
                value={guestOrderId}
                onChange={(event) => setGuestOrderId(event.target.value)}
                placeholder="주문번호 (예: ORD-xxxx)"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                required
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                비회원 주문조회
              </button>
            </form>

            <button
              type="button"
              onClick={() => router.push("/signup?callback=/orders")}
              className="mt-3 w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-800"
            >
              로그인/회원가입하고 내 주문 보기
            </button>
          </>
        )}

        {isLoggedIn && memberError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{memberError}</p>}
      </section>

      {isLoggedIn && memberOrders.length > 0 && (
        <section className="space-y-3 rounded-3xl border border-lime-200 bg-lime-50 p-5 shadow">
          <p className="text-xs font-bold uppercase tracking-wide text-lime-700">내 주문내역</p>
          {memberOrders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-lime-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-stone-700">주문번호: {order.id}</p>
                <Link
                  href={`/orders/${encodeURIComponent(order.id)}`}
                  className="rounded-lg border border-lime-300 bg-white px-2 py-1 text-xs font-semibold text-lime-800"
                >
                  상세보기
                </Link>
              </div>
              <p className="text-sm text-stone-700">입금자명: {order.depositorName}</p>
              <p className="text-sm text-stone-700">연락처: {formatPhone(order.phone)}</p>
              <p className="text-sm text-stone-700">주문금액: {formatCurrency(order.totalAmount)}</p>
              <p className="mt-2 text-base font-bold text-lime-800">현재 상태: {order.status}</p>
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
            </article>
          ))}
        </section>
      )}

      {isLoggedIn && !memberLoading && !memberError && memberOrders.length === 0 && (
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow">
          <p className="text-sm text-stone-600">조회된 주문이 없습니다.</p>
        </section>
      )}
    </main>
  );
}
