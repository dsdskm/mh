"use client";

import { FormEvent, useMemo, useState } from "react";
import type { AdminPageState } from "../../_hooks/use-admin-page";
import { formatCurrency } from "../../_lib/constants";
import type {
  AdminUser,
  CouponDiscountType,
  CouponTemplate,
  MileageSummary,
} from "../../_lib/types";
import { PaginationControls } from "../../_components/pagination-controls";
import { usePersistedPagination } from "../../_hooks/use-persisted-pagination";

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
  const { accounts, coupons, couponTemplates } = state;

  // 관리자(MASTER) 계정 제외
  const memberAccounts = useMemo(
    () => accounts.filter((a) => a.type !== "MASTER"),
    [accounts],
  );

  // ----- 생성된 쿠폰(템플릿) 페이지네이션 -----
  const couponTemplatePagination = usePersistedPagination({
    storageKey: "admin:pagination:coupon-templates",
    totalItems: couponTemplates.length,
    pageSizeOptions: [10, 20, 50],
    initialPageSize: 20,
  });

  const paginatedCouponTemplates = useMemo(() => {
    const { startIndex, endIndex } = couponTemplatePagination;
    return couponTemplates.slice(startIndex, endIndex);
  }, [couponTemplates, couponTemplatePagination]);

  // ----- 발급된 쿠폰 페이지네이션 -----
  const couponPagination = usePersistedPagination({
    storageKey: "admin:pagination:coupons",
    totalItems: coupons.length,
    pageSizeOptions: [10, 20, 50],
    initialPageSize: 20,
  });

  const paginatedCoupons = useMemo(() => {
    const { startIndex, endIndex } = couponPagination;
    return coupons.slice(startIndex, endIndex);
  }, [coupons, couponPagination]);

  // ----- 쿠폰 생성 팝업 -----
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDiscountType, setTemplateDiscountType] =
    useState<CouponDiscountType>("fixed");
  const [templateDiscountValue, setTemplateDiscountValue] = useState("3000");
  const [templateMaxDiscountAmount, setTemplateMaxDiscountAmount] = useState("");
  const [templateValidUntil, setTemplateValidUntil] = useState("");
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [templateCreateError, setTemplateCreateError] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<CouponTemplate | null>(null);

  // ----- 쿠폰 발급 폼 -----
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">("");
  const [targetMode, setTargetMode] = useState<"all" | "select">("select");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueFeedback, setIssueFeedback] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [showIssueConfirmModal, setShowIssueConfirmModal] = useState(false);
  const [revokeCouponTarget, setRevokeCouponTarget] = useState<{ id: number; name: string } | null>(null);

  const selectedTemplate = useMemo<CouponTemplate | null>(() => {
    if (selectedTemplateId === "") {
      return null;
    }
    return couponTemplates.find((template) => template.id === selectedTemplateId) ?? null;
  }, [couponTemplates, selectedTemplateId]);

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

  async function handleCreateTemplate() {
    setTemplateCreateError(null);

    if (!templateName.trim()) {
      setTemplateCreateError("쿠폰 이름을 입력해주세요.");
      return;
    }
    const value = Math.floor(Number(templateDiscountValue) || 0);
    if (value <= 0) {
      setTemplateCreateError("할인 값을 입력해주세요.");
      return;
    }

    setCreatingTemplate(true);
    try {
      const ok = await state.createCouponTemplate({
        name: templateName.trim(),
        discountType: templateDiscountType,
        discountValue: value,
        minOrderAmount: 0,
        maxDiscountAmount:
          templateDiscountType === "percent" && templateMaxDiscountAmount.trim()
            ? Math.max(0, Math.floor(Number(templateMaxDiscountAmount) || 0))
            : null,
        validUntil: templateValidUntil ? new Date(templateValidUntil).toISOString() : null,
      });
      if (ok) {
        setTemplateName("");
        setTemplateDiscountType("fixed");
        setTemplateDiscountValue("3000");
        setTemplateMaxDiscountAmount("");
        setTemplateValidUntil("");
        setTemplateCreateError(null);
        setShowCreateModal(false);
      }
    } finally {
      setCreatingTemplate(false);
    }
  }

  function submitCreateTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleCreateTemplate();
  }

  function handleDeleteTemplate(template: CouponTemplate) {
    setDeleteTemplateTarget(template);
  }

  async function confirmDeleteTemplate() {
    if (!deleteTemplateTarget) {
      return;
    }

    setDeletingTemplateId(deleteTemplateTarget.id);
    try {
      await state.deleteCouponTemplate(deleteTemplateTarget.id);
      if (selectedTemplateId === deleteTemplateTarget.id) {
        setSelectedTemplateId("");
      }
      setDeleteTemplateTarget(null);
    } finally {
      setDeletingTemplateId(null);
    }
  }

  async function confirmRevokeCoupon() {
    if (!revokeCouponTarget) {
      return;
    }

    try {
      await state.revokeCoupon(revokeCouponTarget.id);
      setRevokeCouponTarget(null);
    } catch {
      // state.revokeCoupon 내부에서 에러 처리/표시
    }
  }

  function openIssueConfirmModal() {
    setIssueFeedback(null);
    setIssueError(null);

    if (selectedTemplateId === "") {
      setIssueError("발급할 쿠폰을 선택해주세요.");
      return;
    }
    if (targetMode === "select" && selectedIds.length === 0) {
      setIssueError("지급 대상 회원을 선택해주세요.");
      return;
    }

    setShowIssueConfirmModal(true);
  }

  async function handleIssueByTemplate() {
    setShowIssueConfirmModal(false);

    setIssuing(true);
    try {
      const issued = await state.issueCouponByTemplate({
        couponTemplateId: selectedTemplateId,
        accountIds: targetMode === "all" ? "all" : selectedIds,
      });
      setSelectedIds([]);
      setIssueFeedback(`쿠폰 ${issued}건이 발급되었습니다.`);
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : "쿠폰 발급에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIssuing(false);
    }
  }

  function couponDiscountLabel(coupon: {
    discountType: CouponDiscountType;
    discountValue: number;
    maxDiscountAmount?: number | null;
  }): string {
    if (coupon.discountType === "percent") {
      return `${coupon.discountValue}%${coupon.maxDiscountAmount ? ` (최대 ${formatCurrency(coupon.maxDiscountAmount)})` : ""}`;
    }
    return formatCurrency(coupon.discountValue);
  }

  // ----- 적립금 관리 -----
  const [mileageAccountId, setMileageAccountId] = useState<number | "">("");
  const [mileageSummary, setMileageSummary] = useState<MileageSummary | null>(
    null,
  );
  const [mileageLoading, setMileageLoading] = useState(false);

  // ----- 적립금 거래 내역 페이지네이션 -----
  const mileageTxPagination = usePersistedPagination({
    storageKey: "admin:pagination:mileage-tx",
    totalItems: mileageSummary?.transactions.length ?? 0,
    pageSizeOptions: [10, 20, 50],
    initialPageSize: 20,
  });

  const paginatedMileageTx = useMemo(() => {
    const { startIndex, endIndex } = mileageTxPagination;
    return (mileageSummary?.transactions ?? []).slice(startIndex, endIndex);
  }, [mileageSummary, mileageTxPagination]);

  async function loadMileage(accountId: number) {
    setMileageLoading(true);
    const summary = await state.getAccountMileage(accountId);
    setMileageSummary(summary);
    setMileageLoading(false);
  }

  return (
    <div className="space-y-8 p-4">
      {/* 쿠폰 생성 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-stone-800">쿠폰 생성</h2>
            <p className="mt-1 text-xs text-stone-500">
              쿠폰 정책을 먼저 생성한 뒤, 발급 단계에서 대상 회원에게 지급합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setTemplateCreateError(null);
              setShowCreateModal(true);
            }}
            className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white"
          >
            쿠폰 등록
          </button>
        </div>
      </section>

      {/* 생성된 쿠폰 목록 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-bold text-stone-800">생성된 쿠폰 목록 ({couponTemplates.length})</h2>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-stone-500">
              <tr className="border-b border-stone-200">
                <th className="py-2">이름</th>
                <th className="py-2">할인</th>
                <th className="py-2">유효기한</th>
                <th className="py-2">생성일</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedCouponTemplates.map((template) => (
                <tr key={template.id} className="border-b border-stone-100">
                  <td className="py-2">{template.name}</td>
                  <td className="py-2">{couponDiscountLabel(template)}</td>
                  <td className="py-2">
                    {template.validUntil
                      ? new Date(template.validUntil).toLocaleDateString("ko-KR")
                      : "무기한"}
                  </td>
                  <td className="py-2">{new Date(template.createdAt).toLocaleString("ko-KR")}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(template)}
                      disabled={deletingTemplateId === template.id}
                      className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-60"
                    >
                      {deletingTemplateId === template.id ? "삭제 중..." : "삭제"}
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedCouponTemplates.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-xs text-stone-400">
                    생성된 쿠폰이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {couponTemplates.length > 0 && (
          <div className="mt-4 border-t border-stone-200 pt-4">
            <PaginationControls
              currentPage={couponTemplatePagination.currentPage}
              totalPages={couponTemplatePagination.totalPages}
              totalItems={couponTemplates.length}
              pageSize={couponTemplatePagination.pageSize}
              pageSizeOptions={couponTemplatePagination.pageSizeOptions}
              onPageChange={couponTemplatePagination.setCurrentPage}
              onPageSizeChange={couponTemplatePagination.setPageSize}
            />
          </div>
        )}
      </section>

      {/* 쿠폰 발급 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-bold text-stone-800">쿠폰 발급</h2>
        <p className="mt-1 text-xs text-stone-500">
          생성된 쿠폰을 선택해 회원에게 발급합니다.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">발급 쿠폰</span>
            <select
              value={selectedTemplateId}
              onChange={(e) =>
                setSelectedTemplateId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="">쿠폰 선택</option>
              {couponTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedTemplate && (
          <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
            <p>
              할인: <span className="font-semibold text-stone-800">{couponDiscountLabel(selectedTemplate)}</span>
            </p>
            <p>
              유효기한:
              <span className="font-semibold text-stone-800">
                {selectedTemplate.validUntil
                  ? ` ${new Date(selectedTemplate.validUntil).toLocaleDateString("ko-KR")}`
                  : " 무기한"}
              </span>
            </p>
          </div>
        )}

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
            onClick={openIssueConfirmModal}
            disabled={
              issuing ||
              selectedTemplateId === "" ||
              (targetMode === "select" && selectedIds.length === 0)
            }
            className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {issuing ? "발급 중..." : "쿠폰 발급"}
          </button>
          {issueFeedback && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {issueFeedback}
            </p>
          )}
          {issueError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {issueError}
            </p>
          )}
        </div>
      </section>

      {showIssueConfirmModal && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">쿠폰 발급 확인</h3>
            <div className="mt-3 space-y-1 rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
              <p>
                쿠폰: <span className="font-semibold text-stone-900">{selectedTemplate?.name ?? "-"}</span>
              </p>
              <p>
                대상: <span className="font-semibold text-stone-900">{targetMode === "all" ? `전체 회원 ${memberAccounts.length}명` : `${selectedIds.length}명`}</span>
              </p>
            </div>
            <p className="mt-3 text-sm text-stone-600">정말 발급하시겠어요?</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowIssueConfirmModal(false)}
                disabled={issuing}
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleIssueByTemplate()}
                disabled={issuing}
                className="flex-1 rounded-xl bg-lime-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {issuing ? "발급 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <th className="py-2">유효기한</th>
                <th className="py-2">상태</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedCoupons.map((coupon) => {
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
                      {couponDiscountLabel(coupon)}
                    </td>
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
                          onClick={() => setRevokeCouponTarget({ id: coupon.id, name: coupon.name })}
                          className="rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
                        >
                          회수
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paginatedCoupons.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-xs text-stone-400">
                    발급된 쿠폰이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 쿠폰 페이지네이션 */}
        {coupons.length > 0 && (
          <div className="mt-4 border-t border-stone-200 pt-4">
            <PaginationControls
              currentPage={couponPagination.currentPage}
              totalPages={couponPagination.totalPages}
              totalItems={coupons.length}
              pageSize={couponPagination.pageSize}
              pageSizeOptions={couponPagination.pageSizeOptions}
              onPageChange={couponPagination.setCurrentPage}
              onPageSizeChange={couponPagination.setPageSize}
            />
          </div>
        )}
      </section>

      {/* 적립금 관리 */}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-bold text-stone-800">적립금 관리</h2>
        <p className="mt-1 text-xs text-stone-500">
          회원을 선택해 적립금 잔액과 내역을 확인할 수 있습니다.
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
                  {paginatedMileageTx.map((tx) => (
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
                  {paginatedMileageTx.length === 0 && !mileageLoading && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-xs text-stone-400">
                        적립금 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 적립금 거래 내역 페이지네이션 */}
            {(mileageSummary?.transactions ?? []).length > 0 && (
              <div className="border-t border-stone-200 pt-4">
                <PaginationControls
                  currentPage={mileageTxPagination.currentPage}
                  totalPages={mileageTxPagination.totalPages}
                  totalItems={mileageSummary?.transactions.length ?? 0}
                  pageSize={mileageTxPagination.pageSize}
                  pageSizeOptions={mileageTxPagination.pageSizeOptions}
                  onPageChange={mileageTxPagination.setCurrentPage}
                  onPageSizeChange={mileageTxPagination.setPageSize}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-stone-900">쿠폰 생성</h3>
            <p className="mt-1 text-xs text-stone-500">
              생성된 쿠폰은 발급 단계에서 회원에게 배포할 수 있습니다.
            </p>

            <form onSubmit={submitCreateTemplate} className="mt-4 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-stone-600">쿠폰 이름</span>
                <input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="예: 신규가입 감사 쿠폰"
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                  required
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-stone-600">할인 유형</span>
                  <select
                    value={templateDiscountType}
                    onChange={(event) => setTemplateDiscountType(event.target.value as CouponDiscountType)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                  >
                    <option value="fixed">정액 (원)</option>
                    <option value="percent">정률 (%)</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-stone-600">
                    할인 값 {templateDiscountType === "percent" ? "(%)" : "(원)"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={templateDiscountValue}
                    onChange={(event) => setTemplateDiscountValue(event.target.value)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-stone-600">유효기한 (선택)</span>
                  <input
                    type="date"
                    value={templateValidUntil}
                    onChange={(event) => setTemplateValidUntil(event.target.value)}
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {templateDiscountType === "percent" && (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-stone-600">최대 할인액 (원, 선택)</span>
                  <input
                    type="number"
                    min={0}
                    value={templateMaxDiscountAmount}
                    onChange={(event) => setTemplateMaxDiscountAmount(event.target.value)}
                    placeholder="비우면 상한 없음"
                    className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                  />
                </label>
              )}

              {templateCreateError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{templateCreateError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creatingTemplate}
                  className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700 disabled:opacity-60"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creatingTemplate}
                  className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {creatingTemplate ? "생성 중..." : "생성하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTemplateTarget && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">쿠폰 삭제 확인</h3>
            <p className="mt-2 text-sm text-stone-700">
              쿠폰 "{deleteTemplateTarget.name}"을(를) 삭제할까요?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTemplateTarget(null)}
                disabled={deletingTemplateId === deleteTemplateTarget.id}
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteTemplate()}
                disabled={deletingTemplateId === deleteTemplateTarget.id}
                className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {deletingTemplateId === deleteTemplateTarget.id ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {revokeCouponTarget && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">쿠폰 회수 확인</h3>
            <p className="mt-2 text-sm text-stone-700">
              "{revokeCouponTarget.name}" 쿠폰을 회수할까요?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setRevokeCouponTarget(null)}
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmRevokeCoupon()}
                className="flex-1 rounded-xl bg-stone-700 px-3 py-2 text-sm font-bold text-white"
              >
                회수
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
