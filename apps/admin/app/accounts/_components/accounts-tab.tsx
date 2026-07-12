import { FormEvent, useMemo, useState } from "react";
import {
  AdminUser,
  AdminUserCreatePayload,
  AdminUserStatus,
  AdminUserUpdatePayload,
} from "../../_lib/types";
import {
  AdminShippingAddress,
  checkAdminPhoneApi,
  checkAdminUserIdApi,
  getAdminAccountShippingAddressesApi,
} from "../../_lib/api";
import { sendAdminSmsApi } from "../../_lib/api-messages";
import { formatPhone } from "../../_lib/constants";
import { PaginationControls } from "../../_components/pagination-controls";
import { usePersistedPagination } from "../../_hooks/use-persisted-pagination";

const EDITABLE_STATUS_OPTIONS: { value: AdminUserStatus; label: string }[] = [
  { value: "active", label: "활성" },
  { value: "deactive", label: "비활성" },
];

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
      }) => { open: () => void };
    };
  }
}

type Props = {
  accounts: AdminUser[];
  createAccount: (payload: AdminUserCreatePayload) => Promise<void>;
  updateAccount: (id: number, payload: AdminUserUpdatePayload) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;
};

type ConfirmAction =
  | { kind: "create"; payload: AdminUserCreatePayload }
  | { kind: "update"; id: number; payload: AdminUserUpdatePayload }
  | { kind: "delete"; id: number; name: string; isMaster: boolean };

export function AccountsTab({ accounts, createAccount, updateAccount, deleteAccount }: Props) {
  function isMasterAccount(account: AdminUser): boolean {
    return account.type.toUpperCase() === "MASTER";
  }

  // ── modal state ──────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AdminUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // ── detail popup state ───────────────────────────────────────────────────
  const [detailAccount, setDetailAccount] = useState<AdminUser | null>(null);
  const [detailShipping, setDetailShipping] = useState<AdminShippingAddress[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── SMS popup state ────────────────────────────────────────────────────────
  const [smsTargets, setSmsTargets] = useState<AdminUser[] | null>(null);
  const [smsMessage, setSmsMessage] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsConfirmOpen, setSmsConfirmOpen] = useState(false);

  // ── 단체 문자용 선택 상태 ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openSmsModal(targets: AdminUser[]) {
    if (targets.length === 0) {
      return;
    }
    setSmsTargets(targets);
    setSmsMessage("");
    setSmsError(null);
    setSmsConfirmOpen(false);
  }

  function closeSmsModal() {
    setSmsTargets(null);
    setSmsConfirmOpen(false);
  }

  function submitSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!smsTargets || smsTargets.length === 0) {
      return;
    }

    const content = smsMessage.trim();
    if (!content) {
      setSmsError("메시지를 입력해주세요.");
      return;
    }

    const validTargets = smsTargets.filter((target) => Boolean(target.phone));
    if (validTargets.length === 0) {
      setSmsError("문자를 보낼 수 있는 전화번호가 없습니다.");
      return;
    }

    setSmsConfirmOpen(true);
  }

  async function confirmSmsSend() {
    if (!smsTargets || smsTargets.length === 0) {
      return;
    }

    const content = smsMessage.trim();
    if (!content) {
      setSmsError("메시지를 입력해주세요.");
      setSmsConfirmOpen(false);
      return;
    }

    const validTargets = smsTargets.filter((target) => Boolean(target.phone));
    if (validTargets.length === 0) {
      setSmsError("문자를 보낼 수 있는 전화번호가 없습니다.");
      setSmsConfirmOpen(false);
      return;
    }

    setSmsSending(true);
    setSmsError(null);
    try {
      const results = await Promise.allSettled(
        validTargets.map((target) =>
          sendAdminSmsApi({
            receiver: target.phone!,
            receiverName: target.displayName ?? target.userId ?? undefined,
            content,
          }),
        ),
      );

      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failedResults = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );

      if (failedResults.length > 0) {
        const firstFailed = failedResults[0];
        const firstMessage =
          firstFailed && firstFailed.reason instanceof Error
            ? firstFailed.reason.message
            : "발송 중 오류가 발생했습니다.";
        setSmsError(`성공 ${successCount}건 / 실패 ${failedResults.length}건 - ${firstMessage}`);
        setSmsConfirmOpen(false);
        return;
      }

      closeSmsModal();
      setSmsMessage("");
    } finally {
      setSmsSending(false);
    }
  }

  async function openDetail(acc: AdminUser) {
    setDetailAccount(acc);
    setDetailShipping([]);
    setLoadingDetail(true);
    try {
      const addresses = await getAdminAccountShippingAddressesApi(acc.id);
      setDetailShipping(addresses);
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  }

  // ── form fields ──────────────────────────────────────────────────────────
  const [status, setStatus] = useState<AdminUserStatus>("active");
  const [userId, setUserId] = useState("");
  const [userIdCheckResult, setUserIdCheckResult] = useState<{ available: boolean; message: string } | null>(null);
  const [checkingUserId, setCheckingUserId] = useState(false);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCheckResult, setPhoneCheckResult] = useState<{ available: boolean; message: string } | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [postcodeReady, setPostcodeReady] = useState(false);

  // ── list filter/search ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | AdminUserStatus>("all");
  const [filterType, setFilterType] = useState<string>("all");

  function loadPostcodeScript() {
    if (window.daum?.Postcode) {
      setPostcodeReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = DAUM_POSTCODE_SCRIPT_URL;
    script.async = true;
    script.onload = () => setPostcodeReady(true);
    document.head.appendChild(script);
  }

  function searchAddress() {
    if (!window.daum?.Postcode) return;
    new window.daum.Postcode({
      oncomplete: (data) => {
        const base = data.roadAddress || data.jibunAddress;
        const suffix = data.apartment === "Y" && data.buildingName ? ` (${data.buildingName})` : "";
        setAddress1(`${base}${suffix}`.trim());
      },
    }).open();
  }

  async function checkUserId() {
    const val = userId.trim();
    if (!val) return;
    setCheckingUserId(true);
    try {
      const result = await checkAdminUserIdApi(val);
      setUserIdCheckResult(result);
    } catch {
      setUserIdCheckResult({ available: false, message: "확인 실패" });
    } finally {
      setCheckingUserId(false);
    }
  }

  async function checkPhone() {
    const val = phone.replace(/\D/g, "");
    if (!val) return;
    setCheckingPhone(true);
    try {
      const result = await checkAdminPhoneApi(val);
      setPhoneCheckResult(result);
    } catch {
      setPhoneCheckResult({ available: false, message: "확인 실패" });
    } finally {
      setCheckingPhone(false);
    }
  }

  function openCreateModal() {
    setEditingAccount(null);
    setStatus("active");
    setUserId("");
    setUserIdCheckResult(null);
    setPassword("");
    setDisplayName("");
    setPhone("");
    setPhoneCheckResult(null);
    setAddress1("");
    setAddress2("");
    setModalError(null);
    setShowModal(true);
    loadPostcodeScript();
  }

  function openEditModal(account: AdminUser) {
    setEditingAccount(account);
    setStatus(account.status === "withdraw" ? "deactive" : account.status);
    setUserId(account.userId ?? "");
    setUserIdCheckResult(null);
    setPassword("");
    setDisplayName(account.displayName ?? "");
    setPhone(account.phone ?? "");
    setPhoneCheckResult(null);
    setAddress1(account.address1 ?? "");
    setAddress2(account.address2 ?? "");
    setModalError(null);
    setShowModal(true);
    loadPostcodeScript();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setModalError(null);

    if (editingAccount === null) {
      if (!userIdCheckResult?.available) {
        setModalError("아이디 중복확인을 완료해주세요.");
        return;
      }
      if (!phoneCheckResult?.available) {
        setModalError("전화번호 중복확인을 완료해주세요.");
        return;
      }
    }

    const isActive = status === "active";

    if (editingAccount === null) {
      setConfirmAction({
        kind: "create",
        payload: {
          type: "NORMAL",
          status,
          userId: userId.trim(),
          password: password.trim(),
          displayName: displayName.trim() || undefined,
          phone: phone.replace(/\D/g, "") || undefined,
          address1: address1.trim() || undefined,
          address2: address2.trim() || undefined,
          isActive,
        },
      });
      setConfirmError(null);
      return;
    }

    setConfirmAction({
      kind: "update",
      id: editingAccount.id,
      payload: {
        status,
        displayName: displayName.trim() || undefined,
        password: password.trim() || undefined,
        phone: phone.replace(/\D/g, "") || undefined,
          address1: address1.trim() || undefined,
          address2: address2.trim() || undefined,
        isActive,
      },
    });
    setConfirmError(null);
  }

  function requestDeleteConfirmation(account: AdminUser) {
    setConfirmAction({
      kind: "delete",
      id: account.id,
      name: account.displayName ?? account.userId ?? `#${account.id}`,
      isMaster: isMasterAccount(account),
    });
    setConfirmError(null);
  }

  async function executeConfirmedAction() {
    if (!confirmAction) {
      return;
    }

    if (confirmAction.kind === "delete" && confirmAction.isMaster) {
      setConfirmError("MASTER 계정은 삭제할 수 없습니다.");
      return;
    }

    setSubmitting(true);
    setConfirmError(null);
    try {
      if (confirmAction.kind === "create") {
        await createAccount(confirmAction.payload);
        setShowModal(false);
      } else if (confirmAction.kind === "update") {
        await updateAccount(confirmAction.id, confirmAction.payload);
        setShowModal(false);
      } else {
        await deleteAccount(confirmAction.id);
        setDetailAccount(null);
      }

      setConfirmAction(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "처리에 실패했습니다.";
      if (confirmAction.kind === "delete") {
        setConfirmError(message);
      } else {
        setModalError(message);
        setConfirmAction(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── filtered list ────────────────────────────────────────────────────────
  const filteredAccounts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return [...accounts]
      .sort((a, b) => b.id - a.id)
      .filter((acc) => {
        if (filterStatus !== "all" && acc.status !== filterStatus) return false;
        if (filterType !== "all" && acc.type !== filterType) return false;
        if (q) {
          const haystack = [acc.userId, acc.displayName, acc.phone].join(" ").toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
  }, [accounts, searchQuery, filterStatus, filterType]);

  const { currentPage, setCurrentPage, totalPages, pageSize, setPageSize, pageSizeOptions, startIndex, endIndex } = usePersistedPagination({
    storageKey: "admin:pagination:accounts",
    totalItems: filteredAccounts.length,
    pageSizeOptions: [20, 50, 100],
    resetDeps: [searchQuery, filterStatus, filterType],
  });

  const paginatedAccounts = filteredAccounts.slice(startIndex, endIndex);

  const uniqueTypes = useMemo(() => [...new Set(accounts.map((a) => a.type))], [accounts]);

  // 단체 문자: 전화번호가 있는 계정만 선택 가능
  const selectablePageAccounts = paginatedAccounts.filter((acc) => acc.phone);
  const allPageSelected =
    selectablePageAccounts.length > 0 &&
    selectablePageAccounts.every((acc) => selectedIds.has(acc.id));
  const selectedSmsAccounts = accounts.filter((acc) => selectedIds.has(acc.id) && acc.phone);

  function toggleSelectAllPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        selectablePageAccounts.forEach((acc) => next.delete(acc.id));
      } else {
        selectablePageAccounts.forEach((acc) => next.add(acc.id));
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl text-lime-800">계정관리</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openSmsModal(selectedSmsAccounts)}
            disabled={selectedSmsAccounts.length === 0}
            className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            단체 문자 전송{selectedSmsAccounts.length > 0 ? ` (${selectedSmsAccounts.length})` : ""}
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white"
          >
            + 계정 생성
          </button>
        </div>
      </div>

      {/* search & filter */}
      <div className="flex flex-wrap gap-3">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="아이디·이름·전화번호 검색"
          className="flex-1 min-w-40 rounded-xl border border-stone-300 px-3 py-2 text-sm"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "all" | AdminUserStatus)}
          className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
        >
          <option value="all">전체 상태</option>
          <option value="active">활성</option>
          <option value="deactive">비활성</option>
          <option value="withdraw">탈퇴</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
        >
          <option value="all">전체 타입</option>
          {uniqueTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* table */}
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full bg-white text-sm">
          <thead className="bg-stone-50 text-xs font-semibold text-stone-600">
            <tr>
              <th className="px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAllPage}
                  disabled={selectablePageAccounts.length === 0}
                  aria-label="현재 페이지 전체 선택"
                  className="h-4 w-4 cursor-pointer accent-sky-600"
                />
              </th>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">이름</th>
              <th className="px-3 py-2 text-left">아이디</th>
              <th className="px-3 py-2 text-left">전화번호</th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-left">가입일</th>
              <th className="px-3 py-2 text-left">문자</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {filteredAccounts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-stone-400">결과 없음</td>
              </tr>
            )}
            {paginatedAccounts.map((acc) => (
              <tr key={acc.id} className="hover:bg-stone-50 cursor-pointer" onClick={() => void openDetail(acc)}>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(acc.id)}
                    onChange={() => toggleSelect(acc.id)}
                    disabled={!acc.phone}
                    aria-label={`${acc.displayName ?? acc.userId ?? acc.id} 선택`}
                    className="h-4 w-4 cursor-pointer accent-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </td>
                <td className="px-3 py-2 text-stone-500">#{acc.id}</td>
                <td className="px-3 py-2 font-medium text-stone-900">{acc.displayName ?? "-"}</td>
                <td className="px-3 py-2 text-stone-700">{acc.userId ?? "-"}</td>
                <td className="px-3 py-2 text-stone-700">{acc.phone ?? "-"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    acc.status === "active" ? "bg-lime-100 text-lime-800" :
                    acc.status === "withdraw" ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-800"
                  }`}>
                    {acc.status === "active" ? "활성" : acc.status === "deactive" ? "비활성" : "탈퇴"}
                  </span>
                </td>
                <td className="px-3 py-2 text-stone-500 text-xs">{acc.createdAt.slice(0, 10)}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openSmsModal([acc]);
                    }}
                    disabled={!acc.phone}
                    className="rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    문자 전송
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredAccounts.length}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={setPageSize}
        onPageChange={setCurrentPage}
      />

      {/* SMS popup (단건/단체 공통) */}
      {smsTargets && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4"
        >
          <div
            className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-stone-900">
              {smsTargets.length > 1 ? `단체 문자 전송 (${smsTargets.length}명)` : "문자 전송"}
            </h3>
            <form onSubmit={submitSms} className="mt-4 space-y-3">
              <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                <p className="text-xs font-semibold text-stone-500">받는 사람</p>
                {smsTargets.length === 1 ? (
                  <p className="mt-1">
                    {smsTargets[0]!.displayName ?? smsTargets[0]!.userId ?? "이름없음"} · {smsTargets[0]!.phone ? formatPhone(smsTargets[0]!.phone!) : "번호 없음"}
                  </p>
                ) : (
                  <div className="mt-1 max-h-28 overflow-y-auto">
                    <p className="text-stone-800">{smsTargets.length}명에게 전송</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {smsTargets
                        .map((t) => t.displayName ?? t.userId ?? `#${t.id}`)
                        .join(", ")}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-600">메시지</label>
                <textarea
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder="전송할 메시지를 입력하세요."
                  className="h-32 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
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

      {smsTargets && smsConfirmOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">문자 전송 확인</h3>
            <p className="mt-2 text-sm text-stone-700">
              {smsTargets.length === 1
                ? `${smsTargets[0]?.displayName ?? smsTargets[0]?.userId ?? "대상"} 님에게 문자를 전송할까요?`
                : `${smsTargets.length}명에게 문자를 전송할까요?`}
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

      {/* detail popup */}
      {detailAccount && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-stone-900">
                  {detailAccount.displayName ?? "이름없음"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailAccount(null)}
                className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-600"
              >닫기</button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs font-semibold text-stone-500">아이디</dt>
                <dd className="mt-0.5 text-stone-800">{detailAccount.userId ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-stone-500">전화번호</dt>
                <dd className="mt-0.5 text-stone-800">{detailAccount.phone ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-stone-500">상태</dt>
                <dd className="mt-0.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    detailAccount.status === "active" ? "bg-lime-100 text-lime-800" :
                    detailAccount.status === "withdraw" ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-800"
                  }`}>
                    {detailAccount.status === "active" ? "활성" : detailAccount.status === "deactive" ? "비활성" : "탈퇴"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-stone-500">가입일</dt>
                <dd className="mt-0.5 text-stone-800">{detailAccount.createdAt.slice(0, 10)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-semibold text-stone-500">주소</dt>
                <dd className="mt-0.5 text-stone-800">
                  {[detailAccount.address1, detailAccount.address2].filter(Boolean).join(" ") || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-stone-500">약관 동의</dt>
                <dd className="mt-0.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${detailAccount.termsAgreed ? "bg-lime-100 text-lime-800" : "bg-stone-100 text-stone-600"}`}>
                    {detailAccount.termsAgreed ? "동의" : "미동의"}
                  </span>
                </dd>
              </div>
            </dl>

            <div className="mt-5">
              <p className="text-xs font-semibold text-stone-500">배송지 목록</p>
              {loadingDetail && (
                <p className="mt-2 text-xs text-stone-400">불러오는 중...</p>
              )}
              {!loadingDetail && detailShipping.length === 0 && (
                <p className="mt-2 text-xs text-stone-400">등록된 배송지가 없습니다.</p>
              )}
              {!loadingDetail && detailShipping.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {detailShipping.map((s) => (
                    <li key={s.id} className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-stone-800">{s.name}</span>
                        {s.isDefault && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">기본</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-stone-600">{[s.address1, s.address2].filter(Boolean).join(" ")}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => { setDetailAccount(null); openEditModal(detailAccount); }}
                className="flex-1 rounded-xl border border-lime-300 bg-lime-50 px-4 py-2.5 text-sm font-bold text-lime-800"
              >수정</button>
              <button
                type="button"
                onClick={() => requestDeleteConfirmation(detailAccount)}
                disabled={isMasterAccount(detailAccount)}
                className="flex-1 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >{isMasterAccount(detailAccount) ? "삭제 불가" : "삭제"}</button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-bold text-stone-900">확인</h4>
            <p className="mt-2 text-sm text-stone-700">
              {confirmAction.kind === "create" && "계정을 생성하시겠습니까?"}
              {confirmAction.kind === "update" && "계정 정보를 수정하시겠습니까?"}
              {confirmAction.kind === "delete" &&
                (confirmAction.isMaster
                  ? `"${confirmAction.name}" 계정은 삭제할 수 없습니다.`
                  : `"${confirmAction.name}" 계정을 삭제하시겠습니까?`)}
            </p>

            {confirmError && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{confirmError}</p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmAction(null);
                  setConfirmError(null);
                }}
                disabled={submitting}
                className="flex-1 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-bold text-stone-700 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void executeConfirmedAction()}
                disabled={submitting || (confirmAction.kind === "delete" && confirmAction.isMaster)}
                className="flex-1 rounded-xl bg-lime-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {submitting ? "처리 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* edit/create modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-stone-900">
              {editingAccount === null ? "계정 생성" : "계정 수정"}
            </h3>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              {/* status */}
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-stone-600">상태</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AdminUserStatus)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                >
                  {EDITABLE_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              {/* userId – only on create */}
              {editingAccount === null && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-stone-600">아이디</span>
                  <div className="flex gap-2">
                    <input
                      value={userId}
                      onChange={(e) => { setUserId(e.target.value); setUserIdCheckResult(null); }}
                      placeholder="영문 소문자/숫자 4~20자"
                      className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => void checkUserId()}
                      disabled={checkingUserId || !userId.trim()}
                      className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-60"
                    >
                      {checkingUserId ? "확인 중..." : "중복확인"}
                    </button>
                  </div>
                  {userIdCheckResult && (
                    <p className={`rounded-xl px-3 py-2 text-xs ${userIdCheckResult.available ? "bg-lime-50 text-lime-800" : "bg-red-50 text-red-700"}`}>
                      {userIdCheckResult.message}
                    </p>
                  )}
                </div>
              )}

              {/* password */}
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-stone-600">
                  비밀번호{editingAccount !== null && " (변경 시 입력)"}
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="영문+숫자+특수문자 포함 8자 이상"
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                  required={editingAccount === null}
                />
              </label>

              {/* displayName */}
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-stone-600">이름</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
              </label>

              {/* phone */}
              <div className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">전화번호</span>
                <div className="flex gap-2">
                  <input
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, ""));
                      setPhoneCheckResult(null);
                    }}
                    placeholder="숫자만 입력"
                    inputMode="numeric"
                    className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
                  />
                  {editingAccount === null && (
                    <button
                      type="button"
                      onClick={() => void checkPhone()}
                      disabled={checkingPhone || !phone.trim()}
                      className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-60"
                    >
                      {checkingPhone ? "확인 중..." : "중복확인"}
                    </button>
                  )}
                </div>
                {phoneCheckResult && (
                  <p className={`rounded-xl px-3 py-2 text-xs ${phoneCheckResult.available ? "bg-lime-50 text-lime-800" : "bg-red-50 text-red-700"}`}>
                    {phoneCheckResult.message}
                  </p>
                )}
              </div>

              {/* address */}
              <div className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">주소</span>
                <div className="flex gap-2">
                  <input
                    value={address1}
                    readOnly
                    placeholder="주소 검색 클릭"
                    className="flex-1 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-500"
                  />
                  <button
                    type="button"
                    onClick={searchAddress}
                    disabled={!postcodeReady}
                    className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-60"
                  >
                    {postcodeReady ? "주소 검색" : "로딩 중..."}
                  </button>
                </div>
                <input
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                  placeholder="상세 주소 (동/호수 등)"
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
              </div>

              {modalError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{modalError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700 disabled:opacity-60"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {submitting ? "처리 중..." : editingAccount === null ? "계정 생성" : "계정 수정"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

