"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { getProfileApi, getMyCouponsApi, getMyMileageApi } from "../api/account.api";
import type { Coupon } from "@repo/shared-types/coupon";
import type { MileageTransaction } from "@repo/shared-types/mileage";

const KRW = new Intl.NumberFormat("ko-KR");

function formatCurrency(value: number): string {
  return `${KRW.format(value)}원`;
}

const MILEAGE_TX_LABEL: Record<string, string> = {
  earn: "적립",
  use: "사용",
  admin_grant: "지급",
  admin_deduct: "차감",
  restore: "복원/회수",
};

export default function CouponMileagePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = useMemo(() => session?.user?.email ?? "", [session?.user?.email]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [mileageBalance, setMileageBalance] = useState(0);
  const [mileageHistory, setMileageHistory] = useState<MileageTransaction[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callback=/account/coupon-mileage");
      return;
    }

    if (status !== "authenticated" || !userId) {
      return;
    }

    async function loadCouponMileage() {
      setLoading(true);
      setError(null);

      try {
        const profileData = await getProfileApi(userId);
        const [couponsData, mileageData] = await Promise.all([
          getMyCouponsApi(profileData.profile.id),
          getMyMileageApi(profileData.profile.id),
        ]);

        setCoupons(couponsData);
        setMileageBalance(mileageData.balance);
        setMileageHistory(mileageData.transactions);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "쿠폰/적립금 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void loadCouponMileage();
  }, [router, status, userId]);

  if (status === "loading" || loading) {
    return <main className="mx-auto max-w-3xl px-4 py-8 text-sm text-stone-600">불러오는 중...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-center gap-3 text-sm font-semibold text-amber-700">
        <Link href="/">← 홈으로</Link>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="rounded-2xl border border-lime-200 bg-white p-4 shadow-sm sm:p-5">
        <h1 className="text-2xl font-bold text-lime-800">내 쿠폰 / 적립금</h1>

        <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3">
          <span className="text-xs text-stone-600">보유 적립금</span>
          <p className="text-xl font-extrabold text-amber-700">{formatCurrency(mileageBalance)}</p>
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold text-stone-700">보유 쿠폰 ({coupons.length})</p>
          <ul className="mt-2 space-y-2">
            {coupons.map((coupon) => (
              <li
                key={coupon.id}
                className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
              >
                <p className="font-semibold text-stone-800">{coupon.name}</p>
                <p className="text-xs text-stone-600">
                  {coupon.discountType === "percent"
                    ? `${coupon.discountValue}% 할인`
                    : `${formatCurrency(coupon.discountValue)} 할인`}
                  {coupon.minOrderAmount > 0
                    ? ` · ${formatCurrency(coupon.minOrderAmount)} 이상`
                    : ""}
                  {coupon.validUntil
                    ? ` · ~${new Date(coupon.validUntil).toLocaleDateString("ko-KR")}`
                    : " · 무기한"}
                </p>
              </li>
            ))}
            {coupons.length === 0 && (
              <li className="rounded-xl border border-dashed border-stone-200 px-3 py-3 text-center text-xs text-stone-400">
                사용 가능한 쿠폰이 없습니다.
              </li>
            )}
          </ul>
        </div>

        {mileageHistory.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-stone-700">적립금 내역</p>
            <ul className="mt-2 divide-y divide-stone-100">
              {mileageHistory.slice(0, 20).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-xs text-stone-500">
                    {new Date(tx.createdAt).toLocaleDateString("ko-KR")} · {" "}
                    {MILEAGE_TX_LABEL[tx.type] ?? tx.type}
                  </span>
                  <span className={tx.amount >= 0 ? "text-lime-700" : "text-rose-600"}>
                    {tx.amount >= 0 ? "+" : ""}
                    {formatCurrency(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
