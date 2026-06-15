"use client";

import { useMemo, useState } from "react";
import type { AdminPageState } from "../../_hooks/use-admin-page";
import { formatCurrency } from "../../_lib/constants";
import type {
  AdminUser,
  CouponDiscountType,
  MileageSummary,
} from "../../_lib/types";

type Props = {
  state: AdminPageState;
};

const MILEAGE_TX_LABEL: Record<string, string> = {
  earn: "적립",
  use: "사용",
  admin_grant: "지급",
  admin_deduct: "차감",
  restore: "복원/회수",
};

function accountLabel(account: AdminUser): string {
  return (
    account.displayName ||
    account.userId ||
    account.phone ||
    `#${account.id}`
  );
}

export function RewardsTab({ state }: Props) {
  const { accounts, coupons } = state;

  // 관리자(MASTER) 계정 제외
  const memberAccounts = useMemo(
    () => accounts.filter((a) => a.type !== "MASTER"),
    [accounts],
  );

  // ----- 쿠폰 지급 폼 -----
  const [couponName, setCouponName] = useState("");
  const [discountType, setDiscountType] = useState<CouponDiscountType>("fixed");
  const [discountValue, setDiscountValue] = useState("3000");
  const [minOrderAmount, setMinOrderAmount] = useState("0");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [targetMode, setTargetMode] = useState<"all" | "select">("select");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [issuing, setIssuing] = useState(false);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return memberAccounts;
    return memberAccounts.filter((a) =>
      [a.displayName, a.userId, a.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [memberAccounts, memberSearch]);

  function toggleMember(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleIssue() {
    if (!couponName.trim()) {
      window.alert("쿠폰 이름을 입력해주세요.");
      return;
    }
    const value = Math.floor(Number(discountValue) || 0);
    if (value <= 0) {
      window.alert("할인 값을 입력해주세요.");
      return;
    }
    if (targetMode === "select" && selectedIds.length === 0) {
      window.alert("지급 대상 회원을 선택해주세요.");
      return;
    }

    setIssuing(true);
    try {
      const ok = await state.issueCoupon({
        accountIds: targetMode === "all" ? "all" : selectedIds,
        name: couponName.trim(),
        discountType,
        discountValue: value,
        minOrderAmount: Math.max(0, Math.floor(Number(minOrderAmount) || 0)),
        maxDiscountAmount:
          discountType === "percent" && maxDiscountAmount.trim()
            ? Math.max(0, Math.floor(Number(maxDiscountAmount) || 0))
            : null,
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
      });
      if (ok) {
        setCouponName("");
        setSelectedIds([]);
      }
    } finally {
      setIssuing(false);
    }
  }

  // ----- 적립금 관리 -----
  const [mileageAccountId, setMileageAccountId] = useState<number | "">("");
  const [mileageSummary, setMileageSummary] = useState<MileageSummary | null>(
    null,
  );
  const [mileageAmount, setMileageAmount] = useState("");
  const [mileageReason, setMileageReason] = useState("");
  const [mileageLoading, setMileageLoading] = useState(false);

  async function loadMileage(accountId: number) {
    setMileageLoading(true);
    const summary = await state.getAccountMileage(accountId);
    setMileageSummary(summary);
    setMileageLoading(false);
  }

  async function handleAdjust(sign: 1 | -1) {
    if (mileageAccountId === "") {
      window.alert("회원을 선택해주세요.");
      return;
    }
    const amount = Math.floor(Number(mileageAmount) || 0);
    if (amount <= 0) {
      window.alert("변동 금액을 입력해주세요.");
      return;
    }
    const summary = await state.adjustMileage(
      mileageAccountId,
      sign * amount,
      mileageReason.trim() || undefined,
    );
    if (summary) {
      setMileageSummary(summary);
      setMileageAmount("");
      setMileageReason("");
    }
  }

  return (
    <div className="space-y-8 p-4">
      {/* 쿠폰 지급 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-bold text-stone-800">쿠폰 지급</h2>
        <p className="mt-1 text-xs text-stone-500">
          회원에게 쿠폰을 지급합니다. 회원은 주문 시 보유 쿠폰을 선택해 사용할 수 있습니다.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">쿠폰 이름</span>
            <input
              value={couponName}
              onChange={(e) => setCouponName(e.target.value)}
              placeholder="예: 신규가입 감사 쿠폰"
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">할인 유형</span>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as CouponDiscountType)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="fixed">정액 (원)</option>
              <option value="percent">정률 (%)</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">
              할인 값 {discountType === "percent" ? "(%)" : "(원)"}
            </span>
            <input
              type="number"
              min={0}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">최소 주문금액 (원)</span>
            <input
              type="number"
              min={0}
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          {discountType === "percent" && (
            <label className="space-y-1">
              <span className="text-xs font-semibold text-stone-600">최대 할인액 (원, 선택)</span>
              <input
                type="number"
                min={0}
                value={maxDiscountAmount}
                onChange={(e) => setMaxDiscountAmount(e.target.value)}
                placeholder="비우면 상한 없음"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
          )}
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">유효기한 (선택)</span>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={targetMode === "select"}
                onChange={() => setTargetMode("select")}
              />
              <span>특정 회원</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={targetMode === "all"}
                onChange={() => setTargetMode("all")}
              />
              <span>전체 회원 ({memberAccounts.length}명)</span>
            </label>
          </div>

          {targetMode === "select" && (
            <div className="rounded-xl border border-stone-200 p-2">
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="회원 검색 (이름/아이디/연락처)"
                className="mb-2 w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
              />
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {filteredMembers.map((account) => (
                  <label
                    key={account.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-stone-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(account.id)}
                      onChange={() => toggleMember(account.id)}
                    />
                    <span>{accountLabel(account)}</span>
                    <span className="text-xs text-stone-400">
                      {account.userId ?? account.phone ?? ""}
                    </span>
                  </label>
                ))}
                {filteredMembers.length === 0 && (
                  <p className="px-2 py-1 text-xs text-stone-400">회원이 없습니다.</p>
                )}
              </div>
              <p className="mt-1 text-xs text-stone-500">{selectedIds.length}명 선택됨</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleIssue}
            disabled={issuing}
            className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {issuing ? "지급 중..." : "쿠폰 지급"}
          </button>
        </div>
      </section>

      {/* 발급된 쿠폰 목록 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-bold text-stone-800">발급된 쿠폰 ({coupons.length})</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-stone-500">
              <tr className="border-b border-stone-200">
                <th className="py-2">이름</th>
                <th className="py-2">대상</th>
                <th className="py-2">할인</th>
                <th className="py-2">최소주문</th>
                <th className="py-2">유효기한</th>
                <th className="py-2">상태</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const statusLabel =
                  coupon.status === "used"
                    ? "사용됨"
                    : coupon.status === "revoked"
                      ? "회수됨"
                      : coupon.expired
                        ? "만료"
                        : "사용가능";
                return (
                  <tr key={coupon.id} className="border-b border-stone-100">
                    <td className="py-2">{coupon.name}</td>
                    <td className="py-2">{coupon.accountName ?? `#${coupon.accountId}`}</td>
                    <td className="py-2">
                      {coupon.discountType === "percent"
                        ? `${coupon.discountValue}%${coupon.maxDiscountAmount ? ` (최대 ${formatCurrency(coupon.maxDiscountAmount)})` : ""}`
                        : formatCurrency(coupon.discountValue)}
                    </td>
                    <td className="py-2">{formatCurrency(coupon.minOrderAmount)}</td>
                    <td className="py-2">
                      {coupon.validUntil
                        ? new Date(coupon.validUntil).toLocaleDateString("ko-KR")
                        : "무기한"}
                    </td>
                    <td className="py-2">{statusLabel}</td>
                    <td className="py-2 text-right">
                      {coupon.status === "available" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("이 쿠폰을 회수할까요?")) {
                              void state.revokeCoupon(coupon.id);
                            }
                          }}
                          className="rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
                        >
                          회수
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-xs text-stone-400">
                    발급된 쿠폰이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 적립금 관리 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-bold text-stone-800">적립금 관리</h2>
        <p className="mt-1 text-xs text-stone-500">
          회원을 선택해 적립금 잔액과 내역을 확인하고, 수동으로 지급/차감할 수 있습니다.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">회원</span>
            <select
              value={mileageAccountId}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : "";
                setMileageAccountId(id);
                setMileageSummary(null);
                if (id !== "") {
                  void loadMileage(id);
                }
              }}
              className="w-56 rounded-xl border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="">회원 선택</option>
              {memberAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountLabel(account)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {mileageAccountId !== "" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <span className="text-xs text-stone-600">현재 잔액</span>
              <p className="text-xl font-extrabold text-amber-700">
                {mileageLoading
                  ? "불러오는 중..."
                  : formatCurrency(mileageSummary?.balance ?? 0)}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">금액 (원)</span>
                <input
                  type="number"
                  min={0}
                  value={mileageAmount}
                  onChange={(e) => setMileageAmount(e.target.value)}
                  className="w-32 rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 flex-1">
                <span className="text-xs font-semibold text-stone-600">사유 (선택)</span>
                <input
                  value={mileageReason}
                  onChange={(e) => setMileageReason(e.target.value)}
                  placeholder="예: 이벤트 보상"
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => handleAdjust(1)}
                className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white"
              >
                지급
              </button>
              <button
                type="button"
                onClick={() => handleAdjust(-1)}
                className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-bold text-stone-700"
              >
                차감
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-xs text-stone-500">
                  <tr className="border-b border-stone-200">
                    <th className="py-2">일시</th>
                    <th className="py-2">구분</th>
                    <th className="py-2">변동</th>
                    <th className="py-2">잔액</th>
                    <th className="py-2">사유/주문</th>
                  </tr>
                </thead>
                <tbody>
                  {(mileageSummary?.transactions ?? []).map((tx) => (
                    <tr key={tx.id} className="border-b border-stone-100">
                      <td className="py-2">
                        {new Date(tx.createdAt).toLocaleString("ko-KR")}
                      </td>
                      <td className="py-2">{MILEAGE_TX_LABEL[tx.type] ?? tx.type}</td>
                      <td className={`py-2 ${tx.amount >= 0 ? "text-lime-700" : "text-rose-600"}`}>
                        {tx.amount >= 0 ? "+" : ""}
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-2">{formatCurrency(tx.balanceAfter)}</td>
                      <td className="py-2 text-xs text-stone-500">
                        {tx.reason ?? (tx.orderId ? `주문 ${tx.orderId}` : "-")}
                      </td>
                    </tr>
                  ))}
                  {(mileageSummary?.transactions ?? []).length === 0 && !mileageLoading && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-xs text-stone-400">
                        적립금 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
