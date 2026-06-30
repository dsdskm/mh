"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";
import { formatCurrency, formatPhone } from "../_lib/format";
import { getProfileApi } from "../account/api/account.api";
import {
  ORDER_STATUS,
  ORDER_STATUS_FLOW,
  getOrderStatusLabelKo,
} from "@repo/shared-types/order";
import type { OrderStatus } from "@repo/shared-types/order";

type Order = {
  id: number;
  status: OrderStatus;
  cancelReason?: string | null;
  totalAmount: number;
  deliveryFee?: number;
  couponDiscount?: number;
  mileageUsed?: number;
  mileageEarned?: number;
  depositorName: string;
  phone: string;
  shippingAddress?: string;
  requestNote?: string | null;
  items?: Array<{
    productId: number;
    name: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
  }>;
  createdAt: string;
  paymentDueAt?: string | null;
  statusHistory?: Array<{ status: OrderStatus; at: string }>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "");
const GUEST_LOOKUP_PHONE_KEY = "cornmarket:guest-lookup-phone";
const GUEST_LOOKUP_TOKEN_KEY = "cornmarket:guest-lookup-token";
const STATUS_FLOW: Order["status"][] = ORDER_STATUS_FLOW;

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

// 전체 상태 흐름을 가로로 표시하고, 처리되지 않은 단계는 흐릿하게 표시
function renderStatusTimeline(order: Order) {
  if (!order.statusHistory || order.statusHistory.length === 0) {
    return null;
  }

  const atByStatus = new Map<string, string>();
  for (const entry of order.statusHistory) {
    if (!atByStatus.has(entry.status)) {
      atByStatus.set(entry.status, entry.at);
    }
  }

  const steps: { status: OrderStatus; at: string | null; done: boolean }[] =
    ORDER_STATUS_FLOW.map((status) => ({
      status,
      at: atByStatus.get(status) ?? null,
      done: atByStatus.has(status),
    }));
  for (const cancelStatus of [ORDER_STATUS.CANCEL_REQUESTED, ORDER_STATUS.CANCEL_COMPLETED] as OrderStatus[]) {
    if (atByStatus.has(cancelStatus)) {
      steps.push({ status: cancelStatus, at: atByStatus.get(cancelStatus)!, done: true });
    }
  }

  return (
    <div className="mb-2 mt-2 rounded-xl bg-stone-50 p-2">
      <p className="text-xs font-semibold text-stone-500">상태 처리 이력</p>
      <ol className="mt-1 flex items-start gap-1 overflow-x-auto pb-1">
        {steps.map((step, idx) => {
          const d = step.at ? new Date(step.at) : null;
          const isCancel =
            step.status === ORDER_STATUS.CANCEL_REQUESTED || step.status === ORDER_STATUS.CANCEL_COMPLETED;
          return (
            <li key={idx} className="flex items-start gap-1">
              <div className={`flex min-w-[80px] flex-col items-center text-center ${step.done ? "" : "opacity-40"}`}>
                <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  step.done ? (isCancel ? "bg-red-100 text-red-700" : "bg-lime-100 text-lime-800") : "bg-stone-100 text-stone-400"
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

export default function OrdersPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated";

  const [guestPhone, setGuestPhone] = useState("");
  const [guestCode, setGuestCode] = useState("");
  const [guestCodeSent, setGuestCodeSent] = useState(false);
  const [guestLookupToken, setGuestLookupToken] = useState<string | null>(null);
  const [guestOrders, setGuestOrders] = useState<Order[]>([]);
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestVerifying, setGuestVerifying] = useState(false);
  const [guestCodeExpiresAt, setGuestCodeExpiresAt] = useState<number | null>(null);
  const [guestCodeRemainingSec, setGuestCodeRemainingSec] = useState(0);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestSuccess, setGuestSuccess] = useState<string | null>(null);

  const [memberOrders, setMemberOrders] = useState<Order[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    const userId = session?.user?.email?.trim();
    if (!userId) {
      setMemberError("로그인 정보를 확인할 수 없습니다.");
      return;
    }

    void loadMemberOrdersByUserId(userId);
  }, [isLoggedIn, session?.user?.email]);

  useEffect(() => {
    if (isLoggedIn) {
      return;
    }

    const savedPhone = sessionStorage.getItem(GUEST_LOOKUP_PHONE_KEY) ?? "";
    const savedToken = sessionStorage.getItem(GUEST_LOOKUP_TOKEN_KEY) ?? "";

    if (!savedPhone || !savedToken) {
      return;
    }

    setGuestPhone(savedPhone);
    setGuestLookupToken(savedToken);
    void loadGuestOrders(savedPhone, savedToken);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!guestCodeSent || guestLookupToken || !guestCodeExpiresAt) {
      setGuestCodeRemainingSec(0);
      return;
    }

    const updateRemaining = () => {
      const nextRemaining = Math.max(
        0,
        Math.ceil((guestCodeExpiresAt - Date.now()) / 1000),
      );
      setGuestCodeRemainingSec(nextRemaining);

      if (nextRemaining <= 0) {
        setGuestCodeSent(false);
        setGuestCodeExpiresAt(null);
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [guestCodeSent, guestLookupToken, guestCodeExpiresAt]);

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

  async function loadMemberOrdersByUserId(userId: string) {
    setMemberLoading(true);
    setMemberError(null);
    setMemberOrders([]);

    try {
      const profileData = await getProfileApi(userId);
      const phone = profileData.profile.phone?.trim();

      if (!phone) {
        setMemberOrders([]);
        return;
      }

      await loadMemberOrders(phone);
    } catch (fetchError) {
      setMemberError(fetchError instanceof Error ? fetchError.message : "조회 실패");
      setMemberLoading(false);
    }
  }

  async function loadGuestOrders(phone: string, lookupToken: string) {
    setGuestLoading(true);
    setGuestError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/orders/guest?phone=${encodeURIComponent(phone)}&lookupToken=${encodeURIComponent(lookupToken)}`,
      );

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "주문 내역 조회에 실패했습니다.");
      }

      const orders = (await response.json()) as Order[];
      setGuestOrders(orders);
    } catch (fetchError) {
      sessionStorage.removeItem(GUEST_LOOKUP_PHONE_KEY);
      sessionStorage.removeItem(GUEST_LOOKUP_TOKEN_KEY);
      setGuestLookupToken(null);
      setGuestOrders([]);
      setGuestError(fetchError instanceof Error ? fetchError.message : "조회 실패");
    } finally {
      setGuestLoading(false);
    }
  }

  async function requestGuestLookupCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = guestPhone.replace(/\D/g, "");
    if (!normalizedPhone) {
      setGuestError("전화번호를 입력해주세요.");
      return;
    }

    setGuestLoading(true);
    setGuestError(null);
    setGuestSuccess(null);
    setGuestLookupToken(null);
    setGuestOrders([]);

    try {
      const response = await fetch(`${API_BASE}/api/orders/lookup/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          purpose: "lookup",
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "인증번호 요청에 실패했습니다.");
      }

      await response.json();
      const expiresAtMs = Date.now() + 3 * 60 * 1000;
      setGuestCodeSent(true);
      setGuestCodeExpiresAt(Number.isFinite(expiresAtMs) ? expiresAtMs : null);
      setGuestSuccess("인증번호를 전송했습니다. 휴대폰 문자를 확인해주세요.");
    } catch (fetchError) {
      setGuestError(fetchError instanceof Error ? fetchError.message : "인증번호 요청 실패");
    } finally {
      setGuestLoading(false);
    }
  }

  async function verifyGuestLookupCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = guestPhone.replace(/\D/g, "");

    if (!normalizedPhone || !guestCode.trim()) {
      setGuestError("전화번호와 인증번호를 입력해주세요.");
      return;
    }

    if (guestCodeRemainingSec <= 0) {
      setGuestError("인증번호가 만료되었습니다. 다시 요청해주세요.");
      return;
    }

    setGuestVerifying(true);
    setGuestError(null);
    setGuestSuccess(null);

    try {
      const response = await fetch(`${API_BASE}/api/orders/lookup/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          code: guestCode.trim(),
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "휴대폰 인증에 실패했습니다.");
      }

      const result = (await response.json()) as {
        lookupToken: string;
        orders: Order[];
      };

      sessionStorage.setItem(GUEST_LOOKUP_PHONE_KEY, normalizedPhone);
      sessionStorage.setItem(GUEST_LOOKUP_TOKEN_KEY, result.lookupToken);
      setGuestLookupToken(result.lookupToken);
      setGuestOrders(result.orders);
      setGuestCodeRemainingSec(0);
      setGuestSuccess("휴대폰 인증이 완료되었습니다. 주문내역을 보여드립니다.");
    } catch (fetchError) {
      setGuestError(fetchError instanceof Error ? fetchError.message : "휴대폰 인증 실패");
    } finally {
      setGuestVerifying(false);
    }
  }

  function canCancelOrder(order: Order): boolean {
    return order.status === ORDER_STATUS.RECEIVED || order.status === ORDER_STATUS.PREPARING;
  }

  async function submitOrderCancel() {
    if (!cancelOrderId) {
      return;
    }

    const normalizedReason = cancelReason.trim();
    if (!normalizedReason) {
      setCancelError("주문 취소 사유를 입력해주세요.");
      return;
    }

    setCancelSubmitting(true);
    setCancelError(null);

    try {
      let phoneForCancel = "";
      let lookupTokenForCancel: string | undefined;

      if (isLoggedIn) {
        const userId = session?.user?.email?.trim();
        if (!userId) {
          throw new Error("로그인 정보를 확인할 수 없습니다.");
        }

        const profileData = await getProfileApi(userId);
        phoneForCancel = profileData.profile.phone?.trim() ?? "";
      } else {
        phoneForCancel = guestPhone.replace(/\D/g, "");
        lookupTokenForCancel = guestLookupToken ?? undefined;
      }

      if (!phoneForCancel) {
        throw new Error("주문자 연락처를 확인할 수 없습니다.");
      }

      const response = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(cancelOrderId)}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phoneForCancel,
          reason: normalizedReason,
          lookupToken: lookupTokenForCancel,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? "주문 취소 요청에 실패했습니다.");
      }

      if (isLoggedIn) {
        const userId = session?.user?.email?.trim();
        if (userId) {
          await loadMemberOrdersByUserId(userId);
        }
      } else if (guestLookupToken) {
        await loadGuestOrders(guestPhone.replace(/\D/g, ""), guestLookupToken);
      }

      setCancelOrderId(null);
      setCancelReason("");
      setGuestSuccess("주문 취소 요청이 완료되었습니다.");
    } catch (cancelSubmitError) {
      setCancelError(
        cancelSubmitError instanceof Error
          ? cancelSubmitError.message
          : "주문 취소 요청에 실패했습니다.",
      );
    } finally {
      setCancelSubmitting(false);
    }
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
          <p className="mt-1 text-sm text-stone-600">비회원은 휴대폰 인증 후 주문내역을 확인할 수 있어요.</p>
        )}

        {isLoggedIn ? (
          <></>
        ) : (
          <>
            <form className="mt-4 space-y-3" onSubmit={requestGuestLookupCode}>
              <input
                value={guestPhone}
                onChange={(event) => {
                  setGuestPhone(event.target.value.replace(/\D/g, ""));
                  setGuestCodeSent(false);
                  setGuestCodeExpiresAt(null);
                  setGuestCodeRemainingSec(0);
                }}
                placeholder="휴대폰 번호 (숫자만 입력)"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                inputMode="numeric"
                required
              />
              <button
                type="submit"
                disabled={guestLoading}
                className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {guestLoading ? "요청 중..." : "인증번호 받기"}
              </button>
            </form>

            {guestCodeSent && (
              <form className="mt-3 space-y-3" onSubmit={verifyGuestLookupCode}>
                <input
                  value={guestCode}
                  onChange={(event) => setGuestCode(event.target.value)}
                  placeholder="문자로 받은 6자리 인증번호"
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                  required
                />
                <button
                  type="submit"
                  disabled={guestVerifying || guestCodeRemainingSec <= 0}
                  className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-800 disabled:opacity-60"
                >
                  {guestVerifying ? "확인 중..." : "인증하고 주문내역 보기"}
                </button>
                <p className={`text-xs font-semibold ${guestCodeRemainingSec > 0 ? "text-amber-700" : "text-red-600"}`}>
                  인증번호 유효시간: {formatCountdown(guestCodeRemainingSec)}
                </p>
              </form>
            )}

            {guestError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{guestError}</p>}
            {guestSuccess && <p className="mt-3 rounded-xl bg-lime-50 p-3 text-sm text-lime-800">{guestSuccess}</p>}

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
                <div className="flex items-center gap-2">
                  {canCancelOrder(order) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelOrderId(order.id);
                        setCancelReason("");
                        setCancelError(null);
                      }}
                      className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                    >
                      주문 취소 요청
                    </button>
                  )}
                </div>
              </div>
              {renderStatusTimeline(order)}
              <p className="text-sm text-stone-700">입금자명: {order.depositorName}</p>
              <p className="text-sm text-stone-700">연락처: {formatPhone(order.phone)}</p>
              {order.deliveryFee != null && order.deliveryFee > 0 && (
                <p className="text-sm text-stone-700">배송료: {formatCurrency(order.deliveryFee)}</p>
              )}
              {order.couponDiscount != null && order.couponDiscount > 0 && (
                <p className="text-sm text-lime-700">쿠폰 할인: -{formatCurrency(order.couponDiscount)}</p>
              )}
              {order.mileageUsed != null && order.mileageUsed > 0 && (
                <p className="text-sm text-lime-700">적립금 사용: -{formatCurrency(order.mileageUsed)}</p>
              )}
              {order.mileageEarned != null && order.mileageEarned > 0 && (
                <p className="text-sm text-lime-700">적립금 적립: {formatCurrency(order.mileageEarned)}</p>
              )}
              <p className="text-sm text-stone-700">주문금액: {formatCurrency(order.totalAmount)}</p>
              <p className="text-sm text-stone-700">배송지: {order.shippingAddress || "-"}</p>
              <p className="text-sm text-stone-700">요청사항: {order.requestNote?.trim() ? order.requestNote : "없음"}</p>
              {order.items && order.items.length > 0 && (
                <div className="mt-2 rounded-xl bg-stone-50 p-3">
                  <p className="text-xs font-semibold text-stone-600">주문 품목</p>
                  <ul className="mt-1 space-y-1 text-xs text-stone-700">
                    {order.items.map((item) => (
                      <li key={`${order.id}-${item.productId}`} className="flex items-center justify-between gap-2">
                        <span>{item.name} x {item.quantity}</span>
                        <span>{formatCurrency(item.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-2 text-xs text-stone-500">주문일시: {new Date(order.createdAt).toLocaleString()}</p>
              <p className="mt-2 text-base font-bold text-lime-800">현재 상태: {getOrderStatusLabelKo(order.status)}</p>
              {order.status === ORDER_STATUS.RECEIVED && order.paymentDueAt && (
                <p className="mt-1 rounded-xl bg-rose-50 p-2 text-xs font-semibold text-rose-700">
                  입금 기한: {new Date(order.paymentDueAt).toLocaleString()} 까지 (미입금 시 자동 취소)
                </p>
              )}
              {(order.status === ORDER_STATUS.CANCEL_REQUESTED || order.status === ORDER_STATUS.CANCEL_COMPLETED) && order.cancelReason && (
                <p className="mt-2 rounded-xl bg-red-50 p-2 text-xs text-red-700">
                  취소 사유: {order.cancelReason}
                </p>
              )}
              <div className="mt-2 flex items-center gap-1 overflow-x-auto">
                {STATUS_FLOW.map((step) => {
                  const isCancelled = order.status === ORDER_STATUS.CANCEL_REQUESTED || order.status === ORDER_STATUS.CANCEL_COMPLETED;
                  const currentIndex = STATUS_FLOW.indexOf(order.status);
                  const stepIndex = STATUS_FLOW.indexOf(step);
                  const done = isCancelled ? false : stepIndex <= currentIndex;
                  return (
                    <span
                      key={step}
                      className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${
                        done ? "bg-lime-200 text-lime-900" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {getOrderStatusLabelKo(step)}
                    </span>
                  );
                })}
                {order.status === ORDER_STATUS.CANCEL_REQUESTED && (
                  <span className="whitespace-nowrap rounded-full bg-orange-100 px-2 py-1 text-[11px] font-semibold text-orange-700">
                    {getOrderStatusLabelKo(ORDER_STATUS.CANCEL_REQUESTED)}
                  </span>
                )}
                {order.status === ORDER_STATUS.CANCEL_COMPLETED && (
                  <span className="whitespace-nowrap rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700">
                    {getOrderStatusLabelKo(ORDER_STATUS.CANCEL_COMPLETED)}
                  </span>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {isLoggedIn && !memberLoading && memberOrders.length === 0 && !memberError && (
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow">
          <p className="text-sm text-stone-600">주문내역이 없습니다.</p>
        </section>
      )}

      {isLoggedIn && !memberLoading && !memberError && memberOrders.length === 0 && (
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow">
          <p className="text-sm text-stone-600">조회된 주문이 없습니다.</p>
        </section>
      )}

      {!isLoggedIn && guestLookupToken && guestOrders.length > 0 && (
        <section className="space-y-3 rounded-3xl border border-lime-200 bg-lime-50 p-5 shadow">
          <p className="text-xs font-bold uppercase tracking-wide text-lime-700">비회원 주문내역</p>
          {guestOrders.map((order) => (
            <article key={order.id} className="rounded-2xl border border-lime-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-stone-700">주문번호: {order.id}</p>
                <div className="flex items-center gap-2">
                  {canCancelOrder(order) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelOrderId(order.id);
                        setCancelReason("");
                        setCancelError(null);
                      }}
                      className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700"
                    >
                      주문 취소 요청
                    </button>
                  )}
                </div>
              </div>
              {renderStatusTimeline(order)}
              <p className="text-sm text-stone-700">입금자명: {order.depositorName}</p>
              <p className="text-sm text-stone-700">연락처: {formatPhone(order.phone)}</p>
              {order.deliveryFee != null && order.deliveryFee > 0 && (
                <p className="text-sm text-stone-700">배송료: {formatCurrency(order.deliveryFee)}</p>
              )}
              {order.couponDiscount != null && order.couponDiscount > 0 && (
                <p className="text-sm text-lime-700">쿠폰 할인: -{formatCurrency(order.couponDiscount)}</p>
              )}
              {order.mileageUsed != null && order.mileageUsed > 0 && (
                <p className="text-sm text-lime-700">적립금 사용: -{formatCurrency(order.mileageUsed)}</p>
              )}
              {order.mileageEarned != null && order.mileageEarned > 0 && (
                <p className="text-sm text-lime-700">적립금 적립: {formatCurrency(order.mileageEarned)}</p>
              )}
              <p className="text-sm text-stone-700">주문금액: {formatCurrency(order.totalAmount)}</p>
              <p className="text-sm text-stone-700">배송지: {order.shippingAddress || "-"}</p>
              <p className="text-sm text-stone-700">요청사항: {order.requestNote?.trim() ? order.requestNote : "없음"}</p>
              {order.items && order.items.length > 0 && (
                <div className="mt-2 rounded-xl bg-stone-50 p-3">
                  <p className="text-xs font-semibold text-stone-600">주문 품목</p>
                  <ul className="mt-1 space-y-1 text-xs text-stone-700">
                    {order.items.map((item) => (
                      <li key={`${order.id}-${item.productId}`} className="flex items-center justify-between gap-2">
                        <span>{item.name} x {item.quantity}</span>
                        <span>{formatCurrency(item.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-2 text-xs text-stone-500">주문일시: {new Date(order.createdAt).toLocaleString()}</p>
              <p className="mt-2 text-base font-bold text-lime-800">현재 상태: {getOrderStatusLabelKo(order.status)}</p>
              {order.status === ORDER_STATUS.RECEIVED && order.paymentDueAt && (
                <p className="mt-1 rounded-xl bg-rose-50 p-2 text-xs font-semibold text-rose-700">
                  입금 기한: {new Date(order.paymentDueAt).toLocaleString()} 까지 (미입금 시 자동 취소)
                </p>
              )}
              {(order.status === ORDER_STATUS.CANCEL_REQUESTED || order.status === ORDER_STATUS.CANCEL_COMPLETED) && order.cancelReason && (
                <p className="mt-2 rounded-xl bg-red-50 p-2 text-xs text-red-700">
                  취소 사유: {order.cancelReason}
                </p>
              )}
              <div className="mt-2 flex items-center gap-1 overflow-x-auto">
                {STATUS_FLOW.map((step) => {
                  const isCancelled = order.status === ORDER_STATUS.CANCEL_REQUESTED || order.status === ORDER_STATUS.CANCEL_COMPLETED;
                  const currentIndex = STATUS_FLOW.indexOf(order.status);
                  const stepIndex = STATUS_FLOW.indexOf(step);
                  const done = isCancelled ? false : stepIndex <= currentIndex;
                  return (
                    <span
                      key={step}
                      className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${
                        done ? "bg-lime-200 text-lime-900" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {getOrderStatusLabelKo(step)}
                    </span>
                  );
                })}
                {order.status === ORDER_STATUS.CANCEL_REQUESTED && (
                  <span className="whitespace-nowrap rounded-full bg-orange-100 px-2 py-1 text-[11px] font-semibold text-orange-700">
                    {getOrderStatusLabelKo(ORDER_STATUS.CANCEL_REQUESTED)}
                  </span>
                )}
                {order.status === ORDER_STATUS.CANCEL_COMPLETED && (
                  <span className="whitespace-nowrap rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700">
                    {getOrderStatusLabelKo(ORDER_STATUS.CANCEL_COMPLETED)}
                  </span>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {!isLoggedIn && guestLookupToken && !guestVerifying && guestOrders.length === 0 && (
        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow">
          <p className="text-sm text-stone-600">조회된 주문이 없습니다.</p>
        </section>
      )}

      {cancelOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (!cancelSubmitting) {
              setCancelOrderId(null);
              setCancelError(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-3xl text-red-700">주문 취소 요청</h2>
            <p className="mt-1 text-sm text-stone-600">취소 요청 사유를 입력해주세요. 운영자가 확인후 알려드립니다.</p>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="취소 요청 사유를 입력하세요"
              className="mt-3 h-24 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              required
            />
            {cancelError && (
              <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{cancelError}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCancelOrderId(null);
                  setCancelError(null);
                }}
                disabled={cancelSubmitting}
                className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void submitOrderCancel()}
                disabled={cancelSubmitting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {cancelSubmitting ? "처리 중..." : "주문 취소 요청"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
