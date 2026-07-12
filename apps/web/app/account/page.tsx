"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getProfileApi,
  updateProfileApi,
  withdrawApi,
  getMyCouponsApi,
  getMyMileageApi,
} from "./api/account.api";
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

const DAUM_POSTCODE_SCRIPT_URL =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

type DaumPostcodeData = {
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  apartment: "Y" | "N";
};

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
      }) => {
        open: () => void;
      };
    };
  }
}

export default function AccountPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = useMemo(() => session?.user?.email ?? "", [session?.user?.email]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawReasonPreset, setWithdrawReasonPreset] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawConfirmModal, setShowWithdrawConfirmModal] = useState(false);
  const [postcodeReady, setPostcodeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [mileageBalance, setMileageBalance] = useState(0);
  const [mileageHistory, setMileageHistory] = useState<MileageTransaction[]>([]);
  const [accountType, setAccountType] = useState<"NORMAL" | "KAKAO" | "NAVER" | "MASTER" | null>(null);

  useEffect(() => {
    if (window.daum?.Postcode) {
      setPostcodeReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = DAUM_POSTCODE_SCRIPT_URL;
    script.async = true;
    script.onload = () => setPostcodeReady(true);

    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signup?callback=/account");
      return;
    }

    if (status !== "authenticated" || !userId) {
      return;
    }

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const profileData = await getProfileApi(userId);
        setAccountType(profileData.profile.accountType ?? "NORMAL");
        setName(profileData.profile.name);
        setPhone(profileData.profile.phone);
        setAddress1(profileData.profile.address1);
        setAddress2(profileData.profile.address2);

        try {
          const [couponsData, mileageData] = await Promise.all([
            getMyCouponsApi(profileData.profile.id),
            getMyMileageApi(profileData.profile.id),
          ]);
          setCoupons(couponsData);
          setMileageBalance(mileageData.balance);
          setMileageHistory(mileageData.transactions);
        } catch {
          // 쿠폰/적립금 로드 실패는 조용히 무시
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "회원 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [router, status, userId]);

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setError("로그인 정보가 없습니다.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await updateProfileApi({
        userId,
        name: name.trim(),
        address1: address1.trim(),
        address2: address2.trim(),
        currentPassword: accountType === "KAKAO" ? undefined : currentPassword,
        newPassword: accountType === "KAKAO" ? undefined : newPassword.trim() || undefined,
      });

      setName(result.profile.name);
      setPhone(result.profile.phone);
      setAddress1(result.profile.address1);
      setAddress2(result.profile.address2);
      setCurrentPassword("");
      setNewPassword("");
      setSuccess("회원정보가 수정되었습니다.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "정보수정 실패");
    } finally {
      setSaving(false);
    }
  }

  function searchAddress() {
    if (!window.daum?.Postcode) {
      setError("주소 검색 준비 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data) => {
        const baseAddress = data.roadAddress || data.jibunAddress;
        const buildingSuffix =
          data.apartment === "Y" && data.buildingName
            ? ` (${data.buildingName})`
            : "";

        setAddress1(`${baseAddress}${buildingSuffix}`.trim());
        setError(null);
      },
    }).open();
  }

  function openWithdrawConfirmModal() {
    if (!userId) {
      setError("로그인 정보가 없습니다.");
      return;
    }

    if (!withdrawPassword.trim()) {
      if (accountType !== "KAKAO") {
        setError("탈퇴 확인 비밀번호를 입력해주세요.");
        return;
      }
    }

    setError(null);
    setSuccess(null);
    setShowWithdrawConfirmModal(true);
  }

  async function submitWithdraw() {
    if (!userId) {
      setError("로그인 정보가 없습니다.");
      return;
    }

    setWithdrawing(true);
    setError(null);
    setSuccess(null);

    try {
      await withdrawApi({
        userId,
        password: accountType === "KAKAO" ? undefined : withdrawPassword,
        reason: withdrawReason.trim() || undefined,
      });

      setShowWithdrawConfirmModal(false);
      await signOut({ callbackUrl: "/" });
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : "탈퇴 실패");
    } finally {
      setWithdrawing(false);
    }
  }

  if (status === "loading" || loading) {
    return <main className="mx-auto max-w-3xl px-4 py-8 text-sm text-stone-600">불러오는 중...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-4 py-6">
      <Link href="/" className="text-sm font-semibold text-amber-700">
        ← 홈으로
      </Link>

      <section className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
        <h1 className="text-2xl font-bold text-amber-800">정보수정</h1>
        <p className="mt-1 text-sm text-stone-600">
          {accountType === "KAKAO" ? "이름과 주소를 변경할 수 있습니다." : "이름, 주소, 비밀번호를 변경할 수 있습니다."}
        </p>

        <form className="mt-4 space-y-3" onSubmit={submitUpdate}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            required
          />
          <input
            value={phone}
            placeholder="전화번호 (수정 불가)"
            className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-500"
            inputMode="numeric"
            readOnly
            required
          />
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={address1}
              placeholder="주소검색 클릭"
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-500"
              readOnly
              required
            />
            <button
              type="button"
              onClick={searchAddress}
              disabled={!postcodeReady}
              className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-60"
            >
              {postcodeReady ? "주소 검색" : "로딩 중..."}
            </button>
          </div>
          <input
            value={address2}
            onChange={(event) => setAddress2(event.target.value)}
            placeholder="상세 주소"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          {accountType !== "KAKAO" && (
            <>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="현재 비밀번호 (필수)"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                required
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="새 비밀번호 (선택)"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "저장 중..." : "정보 저장"}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-700">회원 탈퇴</p>
          <p className="mt-1 text-xs text-red-600">탈퇴 시 계정이 비활성화되며 즉시 로그아웃됩니다.</p>

          {accountType !== "KAKAO" && (
            <input
              type="password"
              value={withdrawPassword}
              onChange={(event) => setWithdrawPassword(event.target.value)}
              placeholder="탈퇴 확인 비밀번호"
              className="mt-3 w-full rounded-xl border border-red-300 px-3 py-2 text-sm"
            />
          )}
          <select
            value={withdrawReasonPreset}
            onChange={(event) => {
              const val = event.target.value;
              setWithdrawReasonPreset(val);
              if (val !== "직접 입력" && val !== "") {
                setWithdrawReason(val);
              } else if (val !== "직접 입력") {
                setWithdrawReason("");
              }
            }}
            className="mt-2 w-full rounded-xl border border-red-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">탈퇴 사유 (선택)</option>
            <option value="상품 불만족">상품 불만족</option>
            <option value="배송 불만족">배송 불만족</option>
            <option value="더 이상 구매할 의사가 없음">더 이상 구매할 의사가 없음</option>
            <option value="기타">기타</option>
            <option value="직접 입력">직접 입력</option>
          </select>
          {withdrawReasonPreset === "직접 입력" && (
            <input
              value={withdrawReason}
              onChange={(event) => setWithdrawReason(event.target.value)}
              placeholder="탈퇴 사유를 직접 입력해주세요"
              className="mt-2 w-full rounded-xl border border-red-300 px-3 py-2 text-sm"
            />
          )}
          <button
            type="button"
            onClick={openWithdrawConfirmModal}
            disabled={withdrawing}
            className="mt-3 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {withdrawing ? "처리 중..." : "회원 탈퇴"}
          </button>
        </div>

        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p className="mt-3 rounded-xl bg-lime-50 p-3 text-sm text-lime-800">{success}</p>}
      </section>

      <section
        id="coupon-mileage"
        className="rounded-2xl border border-lime-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <h2 className="text-xl font-bold text-lime-800">내 쿠폰 / 적립금</h2>

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
                    {new Date(tx.createdAt).toLocaleDateString("ko-KR")} ·{" "}
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

      {showWithdrawConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-red-200 bg-white p-5 shadow-2xl">
            <h2 className="text-2xl font-bold text-red-700">회원 탈퇴</h2>
            <p className="mt-2 text-sm text-stone-700">탈퇴하시겠습니까? 탈퇴 후 즉시 로그아웃됩니다.</p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowWithdrawConfirmModal(false)}
                className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void submitWithdraw()}
                disabled={withdrawing}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {withdrawing ? "처리 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
