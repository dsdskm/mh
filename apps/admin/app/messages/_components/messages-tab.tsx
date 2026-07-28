"use client";

import { FormEvent, useMemo, useState } from "react";
import { AdminUser } from "../../_lib/types";
import { formatPhone } from "../../_lib/constants";
import {
  cancelAdminReservedSmsApi,
  fetchAdminSmsHistoryApi,
  sendAdminKakaoTemplateTestApi,
  sendAdminSmsApi,
  type AdminKakaoTemplateKey,
} from "../../_lib/api-messages";
import type { AdminSmsHistoryItem } from "../../_lib/types";

type Recipient = {
  key: string;
  phone: string;
  label: string;
  source: "manual" | "account";
};

type SendDraft = {
  recipients: Recipient[];
  content: string;
  reserveDT?: string;
  adsYN: boolean;
};

type Props = {
  accounts: AdminUser[];
};

type HistoryRange = "all" | "today" | "7d" | "30d";
const DIRECT_SMS_MAX_CHARS = 45;

const KAKAO_TEMPLATE_OPTIONS: Array<{ key: AdminKakaoTemplateKey; label: string }> = [
  { key: "orderReceived", label: "주문 접수" },
  { key: "paymentConfirmed", label: "입금 확인" },
  { key: "orderCancelRequested", label: "주문 취소 요청" },
  { key: "orderCancelCompleted", label: "주문 취소 완료" },
  { key: "authNumber", label: "인증번호" },
  { key: "signupWelcome", label: "회원가입 환영" },
  { key: "deliveryStarted", label: "배송 시작" },
];

function defaultVariablesByTemplate(templateKey: AdminKakaoTemplateKey): Record<string, string> {
  if (templateKey === "authNumber") {
    return { number: "123456" };
  }
  if (templateKey === "signupWelcome" || templateKey === "deliveryStarted") {
    return { name: "홍길동" };
  }
  if (templateKey === "orderReceived") {
    return {
      orderNo: "2026072800001",
      product: "초당옥수수 10개입",
      amount: "39,000원",
      address: "서울시 강남구 테헤란로 1",
      memo: "문 앞에 놓아주세요",
      bank: "국민은행",
      accountNumber: "123-456-789012",
      accountOwner: "홍길동",
      dueDate: "2026-07-28 23:59",
    };
  }
  return {
    orderNo: "2026072800001",
    product: "초당옥수수 10개입",
    amount: "39,000원",
    address: "서울시 강남구 테헤란로 1",
    memo: "문 앞에 놓아주세요",
  };
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidPhone(value: string): boolean {
  const digits = normalizePhone(value);
  return digits.length === 10 || digits.length === 11;
}

function smsByteLength(content: string): number {
  return Array.from(content).reduce((sum, ch) => sum + (/[^\u0000-\u007f]/.test(ch) ? 2 : 1), 0);
}

function smsCharLength(content: string): number {
  return Array.from(content).length;
}

function toAccountLabel(account: AdminUser): string {
  const name = account.displayName ?? account.username ?? account.userId ?? `계정 #${account.id}`;
  return account.phone ? `${name} (${formatPhone(account.phone)})` : name;
}

function formatReserveForInput(raw?: string | null): string {
  if (!raw || !/^\d{14}$/.test(raw)) {
    return "";
  }

  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  const hour = raw.slice(8, 10);
  const minute = raw.slice(10, 12);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatReserveForApi(input: string): string {
  const normalized = input.trim();
  if (!normalized) {
    return "";
  }

  const matched = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!matched) {
    return "";
  }

  const [, year, month, day, hour, minute] = matched;
  return `${year}${month}${day}${hour}${minute}00`;
}

function formatReserveForView(raw?: string | null): string {
  const input = formatReserveForInput(raw);
  if (!input) {
    return "-";
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("ko-KR");
}

export function MessagesTab({ accounts }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<AdminSmsHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize] = useState(10);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyRange, setHistoryRange] = useState<HistoryRange>("all");
  const [historySearch, setHistorySearch] = useState("");

  const [manualInput, setManualInput] = useState("");
  const [accountIdToAdd, setAccountIdToAdd] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [reserveAt, setReserveAt] = useState("");
  const [adsYN, setAdsYN] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendDraft, setSendDraft] = useState<SendDraft | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminSmsHistoryItem | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [kakaoReceiver, setKakaoReceiver] = useState("");
  const [kakaoReceiverName, setKakaoReceiverName] = useState("");
  const [kakaoTemplateKey, setKakaoTemplateKey] = useState<AdminKakaoTemplateKey>("deliveryStarted");
  const [kakaoVariablesText, setKakaoVariablesText] = useState(
    JSON.stringify(defaultVariablesByTemplate("deliveryStarted"), null, 2),
  );
  const [kakaoSending, setKakaoSending] = useState(false);
  const [kakaoError, setKakaoError] = useState<string | null>(null);
  const [kakaoNotice, setKakaoNotice] = useState<string | null>(null);

  const selectableAccounts = useMemo(() => {
    return accounts
      .filter((account) => account.status === "active" && Boolean(account.phone))
      .slice()
      .sort((a, b) => {
        const nameA = a.displayName ?? a.username ?? a.userId ?? "";
        const nameB = b.displayName ?? b.username ?? b.userId ?? "";
        return nameA.localeCompare(nameB, "ko");
      });
  }, [accounts]);

  const searchedAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return selectableAccounts;
    }

    return selectableAccounts.filter((account) => {
      const haystack = [
        account.displayName,
        account.username,
        account.userId,
        account.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [selectableAccounts, searchQuery]);

  function addRecipient(next: Recipient) {
    setRecipients((prev) => {
      if (prev.some((item) => item.phone === next.phone)) {
        return prev;
      }
      return [...prev, next];
    });
  }

  function addManualRecipients() {
    setError(null);
    setNotice(null);

    const chunks = manualInput
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (chunks.length === 0) {
      setError("수신자 전화번호를 입력해주세요.");
      return;
    }

    const invalid = chunks.find((item) => !isValidPhone(item));
    if (invalid) {
      setError("전화번호는 10~11자리 숫자로 입력해주세요.");
      return;
    }

    chunks.forEach((phoneValue) => {
      const digits = normalizePhone(phoneValue);
      addRecipient({
        key: `manual:${digits}`,
        phone: digits,
        label: formatPhone(digits),
        source: "manual",
      });
    });

    setManualInput("");
  }

  function addSelectedAccount() {
    setError(null);
    setNotice(null);

    if (!accountIdToAdd) {
      setError("불러올 계정을 먼저 선택해주세요.");
      return;
    }

    const account = selectableAccounts.find((item) => String(item.id) === accountIdToAdd);
    if (!account || !account.phone) {
      setError("선택한 계정의 전화번호를 찾을 수 없습니다.");
      return;
    }

    const digits = normalizePhone(account.phone);
    addRecipient({
      key: `account:${account.id}`,
      phone: digits,
      label: toAccountLabel(account),
      source: "account",
    });
    setAccountIdToAdd("");
  }

  function addAccountDirect(account: AdminUser) {
    if (!account.phone) {
      return;
    }

    setError(null);
    setNotice(null);
    const digits = normalizePhone(account.phone);
    addRecipient({
      key: `account:${account.id}`,
      phone: digits,
      label: toAccountLabel(account),
      source: "account",
    });
  }

  function removeRecipient(phone: string) {
    setRecipients((prev) => prev.filter((item) => item.phone !== phone));
  }

  function clearRecipients() {
    setRecipients([]);
  }

  function buildHistoryFilters(range: HistoryRange, keyword: string) {
    const trimmedKeyword = keyword.trim();
    const now = new Date();

    if (range === "all") {
      return {
        query: trimmedKeyword || undefined,
        dateFrom: undefined,
        dateTo: undefined,
      };
    }

    const dateFrom = new Date(now);
    if (range === "today") {
      dateFrom.setHours(0, 0, 0, 0);
    } else if (range === "7d") {
      dateFrom.setDate(dateFrom.getDate() - 7);
    } else if (range === "30d") {
      dateFrom.setDate(dateFrom.getDate() - 30);
    }

    return {
      query: trimmedKeyword || undefined,
      dateFrom: dateFrom.toISOString(),
      dateTo: now.toISOString(),
    };
  }

  async function loadHistory(page: number, options?: { range?: HistoryRange; keyword?: string }) {
    setHistoryLoading(true);
    setHistoryError(null);

    const range = options?.range ?? historyRange;
    const keyword = options?.keyword ?? historySearch;
    const filters = buildHistoryFilters(range, keyword);

    try {
      const result = await fetchAdminSmsHistoryApi(page, historyPageSize, filters);
      setHistoryItems(result.items);
      setHistoryPage(result.page);
      setHistoryTotalPages(result.totalPages);
      setHistoryTotal(result.total);
    } catch (historyLoadError) {
      setHistoryError(
        historyLoadError instanceof Error ? historyLoadError.message : "발송 이력 조회에 실패했습니다.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openHistoryPopup() {
    setHistoryOpen(true);
    await loadHistory(1, { range: historyRange, keyword: historySearch });
  }

  async function submitMessages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (recipients.length === 0) {
      setError("최소 1명 이상의 수신자를 추가해주세요.");
      return;
    }

    const reserveDT = formatReserveForApi(reserveAt);
    if (reserveAt.trim() && !reserveDT) {
      setError("예약일시는 날짜/시간 선택기로 입력해주세요.");
      return;
    }

    if (!message.trim()) {
      setError("문자 내용을 입력해주세요.");
      return;
    }

    const trimmedMessage = message.trim();
    if (smsCharLength(trimmedMessage) > DIRECT_SMS_MAX_CHARS) {
      setError(`메시지 내용은 ${DIRECT_SMS_MAX_CHARS}자 이하여야 합니다.`);
      return;
    }

    setSendDraft({
      recipients: [...recipients],
      content: trimmedMessage,
      reserveDT: reserveDT || undefined,
      adsYN,
    });
  }

  async function confirmSendMessages() {
    if (!sendDraft) {
      return;
    }

    setSending(true);
    setSendDraft(null);

    let successCount = 0;
    const failedRecipients: string[] = [];

    for (const recipient of sendDraft.recipients) {
      try {
        await sendAdminSmsApi({
          receiver: recipient.phone,
          receiverName: recipient.label.slice(0, 70),
          content: sendDraft.content,
          reserveDT: sendDraft.reserveDT,
          adsYN: sendDraft.adsYN,
        });
        successCount += 1;
      } catch (sendError) {
        const reason = sendError instanceof Error ? sendError.message : "알 수 없는 오류";
        failedRecipients.push(`${formatPhone(recipient.phone)} (${reason})`);
      }
    }

    setSending(false);

    if (failedRecipients.length > 0) {
      const preview = failedRecipients.slice(0, 3).join(", ");
      setError(`총 ${sendDraft.recipients.length}건 중 ${failedRecipients.length}건 실패: ${preview}`);
    }

    if (successCount > 0) {
      setNotice(`발송 완료: 성공 ${successCount}건, 실패 ${failedRecipients.length}건`);
      if (failedRecipients.length === 0) {
        setMessage("");
        setReserveAt("");
      }
    }

    setSendDraft(null);
  }

  async function cancelReserved(item: AdminSmsHistoryItem) {
    if (cancelSubmitting) {
      return;
    }

    setCancelSubmitting(true);
    setHistoryError(null);

    try {
      await cancelAdminReservedSmsApi(item.id);
      setCancelTarget(null);
      await loadHistory(historyPage);
    } catch (cancelError) {
      setHistoryError(
        cancelError instanceof Error ? cancelError.message : "예약 문자 취소에 실패했습니다.",
      );
    } finally {
      setCancelSubmitting(false);
    }
  }

  function moveToSection(sectionId: "sms-send-section" | "kakao-template-test-section") {
    if (typeof window === "undefined") {
      return;
    }

    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function changeKakaoTemplate(nextTemplateKey: AdminKakaoTemplateKey) {
    setKakaoTemplateKey(nextTemplateKey);
    setKakaoVariablesText(JSON.stringify(defaultVariablesByTemplate(nextTemplateKey), null, 2));
    setKakaoError(null);
    setKakaoNotice(null);
  }

  async function submitKakaoTemplateTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setKakaoError(null);
    setKakaoNotice(null);

    const receiver = normalizePhone(kakaoReceiver);
    if (!receiver || !/^\d{8,20}$/.test(receiver)) {
      setKakaoError("수신번호는 숫자 8~20자리로 입력해주세요.");
      return;
    }

    let parsedVariables: unknown;
    try {
      parsedVariables = JSON.parse(kakaoVariablesText);
    } catch {
      setKakaoError("변수 JSON 형식이 올바르지 않습니다.");
      return;
    }

    if (!parsedVariables || typeof parsedVariables !== "object" || Array.isArray(parsedVariables)) {
      setKakaoError("변수는 JSON 객체 형태여야 합니다.");
      return;
    }

    const variables = Object.entries(parsedVariables as Record<string, unknown>).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        const normalizedKey = key.trim();
        if (!normalizedKey) {
          return acc;
        }

        acc[normalizedKey] = value === null || value === undefined ? "" : String(value);
        return acc;
      },
      {},
    );

    setKakaoSending(true);
    try {
      const result = await sendAdminKakaoTemplateTestApi({
        receiver,
        receiverName: kakaoReceiverName.trim() || undefined,
        templateKey: kakaoTemplateKey,
        variables,
      });

      setKakaoNotice(`전송 성공: 템플릿 ${result.templateId}, 접수번호 ${result.receiptNum}`);
    } catch (sendError) {
      setKakaoError(
        sendError instanceof Error ? sendError.message : "카카오 템플릿 테스트 전송에 실패했습니다.",
      );
    } finally {
      setKakaoSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl text-lime-800">문자전송</h2>
        <button
          type="button"
          onClick={() => void openHistoryPopup()}
          className="rounded-xl border border-lime-300 bg-lime-50 px-4 py-2 text-sm font-semibold text-lime-800 hover:bg-lime-100"
        >
          발송 이력 보기
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => moveToSection("sms-send-section")}
          className="rounded-xl border border-lime-300 bg-lime-50 px-4 py-2 text-sm font-semibold text-lime-800 hover:bg-lime-100"
        >
          문자 발송 메뉴
        </button>
        <button
          type="button"
          onClick={() => moveToSection("kakao-template-test-section")}
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
        >
          카카오 템플릿 테스트 메뉴
        </button>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}

      <section id="kakao-template-test-section" className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-stone-900">카카오 템플릿 테스트</h3>
          <span className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">임의값 입력 가능</span>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          현재 등록된 카카오 템플릿을 선택하고 변수 JSON을 자유롭게 넣어 테스트 전송할 수 있습니다.
        </p>

        {kakaoError && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {kakaoError}
          </p>
        )}
        {kakaoNotice && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {kakaoNotice}
          </p>
        )}

        <form className="mt-4 space-y-3" onSubmit={submitKakaoTemplateTest}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-stone-700">
              <span>수신번호</span>
              <input
                value={kakaoReceiver}
                onChange={(event) => setKakaoReceiver(event.target.value)}
                placeholder="01012345678"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1 text-sm text-stone-700">
              <span>수신자명 (선택)</span>
              <input
                value={kakaoReceiverName}
                onChange={(event) => setKakaoReceiverName(event.target.value)}
                placeholder="홍길동"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="space-y-1 text-sm text-stone-700">
            <span>템플릿</span>
            <select
              value={kakaoTemplateKey}
              onChange={(event) => changeKakaoTemplate(event.target.value as AdminKakaoTemplateKey)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            >
              {KAKAO_TEMPLATE_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label} ({item.key})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-stone-700">
            <span>변수 JSON</span>
            <textarea
              value={kakaoVariablesText}
              onChange={(event) => setKakaoVariablesText(event.target.value)}
              rows={10}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 font-mono text-xs"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={kakaoSending}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {kakaoSending ? "전송 중..." : "카카오 테스트 전송"}
            </button>
          </div>
        </form>
      </section>

      <section id="sms-send-section" className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-lime-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900">수신자 직접 입력</h3>
          <p className="mt-1 text-sm text-stone-500">쉼표(,) 또는 줄바꿈으로 여러 번호를 한 번에 입력할 수 있습니다.</p>
          <textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            rows={5}
            placeholder="예) 01012345678, 01023456789"
            className="mt-3 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addManualRecipients}
            className="mt-3 rounded-xl bg-lime-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-700"
          >
            직접 입력 번호 추가
          </button>
        </section>

        <section className="rounded-2xl border border-lime-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-stone-900">계정에서 불러오기</h3>
          <p className="mt-1 text-sm text-stone-500">활성 계정 중 전화번호가 등록된 사용자만 표시됩니다.</p>
          <div className="mt-3 flex gap-2">
            <select
              value={accountIdToAdd}
              onChange={(e) => setAccountIdToAdd(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="">계정을 선택하세요</option>
              {selectableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {toAccountLabel(account)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addSelectedAccount}
              className="min-w-[88px] rounded-xl border border-lime-300 bg-lime-50 px-5 py-2 text-sm font-semibold text-lime-800 hover:bg-lime-100"
            >
              추가
            </button>
          </div>

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="계정 검색 (이름/아이디/전화번호)"
            className="mt-3 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-stone-200">
            <ul className="divide-y divide-stone-200">
              {searchedAccounts.slice(0, 30).map((account) => (
                <li key={account.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="text-stone-700">{toAccountLabel(account)}</span>
                  <button
                    type="button"
                    onClick={() => addAccountDirect(account)}
                    className="rounded-lg border border-lime-300 bg-lime-50 px-2 py-1 text-xs font-semibold text-lime-800 hover:bg-lime-100"
                  >
                    수신자 추가
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-lime-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-stone-900">수신자 목록 ({recipients.length})</h3>
          <button
            type="button"
            onClick={clearRecipients}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            전체 삭제
          </button>
        </div>
        {recipients.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">아직 추가된 수신자가 없습니다.</p>
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {recipients.map((recipient) => (
              <li
                key={recipient.key}
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-semibold text-stone-800">{recipient.label}</p>
                  <p className="text-xs text-stone-500">{recipient.source === "manual" ? "직접 입력" : "계정 불러오기"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeRecipient(recipient.phone)}
                  className="rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-white"
                >
                  제거
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-lime-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-stone-900">문자 내용</h3>
        <form onSubmit={submitMessages} className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-1">
            <label className="text-sm text-stone-700">
              예약 발송일시 (선택)
            </label>
            <input
              type="datetime-local"
              value={reserveAt}
              onChange={(e) => setReserveAt(e.target.value)}
              className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={adsYN}
              onChange={(e) => setAdsYN(e.target.checked)}
              disabled
              className="cursor-not-allowed opacity-60"
            />
            <span className="text-stone-400">광고메시지(adsYN)</span>
          </label>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={DIRECT_SMS_MAX_CHARS}
            placeholder="발송할 메시지를 입력하세요"
            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-stone-500">
              {smsCharLength(message)} / {DIRECT_SMS_MAX_CHARS}자
            </p>
            <button
              type="submit"
              disabled={sending}
              className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-700"
            >
              {sending ? "전송 중..." : "알림 발송"}
            </button>
          </div>
        </form>
      </section>
      </section>

      {sendDraft && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-4"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">발송 확인</h3>
            <p className="mt-2 text-sm text-stone-700">
              아래 내용으로 발송할까요?
            </p>
            <div className="mt-3 space-y-1 rounded-xl bg-stone-50 p-3 text-xs text-stone-700">
              <p>수신자 수: {sendDraft.recipients.length}명</p>
              <p>예약일시: {sendDraft.reserveDT ? formatReserveForView(sendDraft.reserveDT) : "즉시 발송"}</p>
              <p>광고메시지: {sendDraft.adsYN ? "예" : "아니오"}</p>
              <p className="line-clamp-3">내용: {sendDraft.content}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSendDraft(null)}
                disabled={sending}
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void confirmSendMessages()}
                disabled={sending}
                className="flex-1 rounded-xl bg-lime-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {sending ? "전송 중..." : "발송"}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-[96vw] overflow-hidden rounded-2xl bg-white shadow-2xl 2xl:max-w-[1700px]">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <h3 className="text-lg font-bold text-stone-900">발송 이력</h3>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="rounded-lg border border-stone-300 px-3 py-1 text-sm text-stone-700 hover:bg-stone-50"
              >
                닫기
              </button>
            </div>

            <div className="space-y-3 p-5">
              <p className="text-sm text-stone-600">
                총 {historyTotal}건 · {historyPage}/{historyTotalPages} 페이지
              </p>

              <div className="grid gap-2 md:grid-cols-[180px_1fr_auto]">
                <select
                  value={historyRange}
                  onChange={(e) => setHistoryRange(e.target.value as HistoryRange)}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="all">전체</option>
                  <option value="today">오늘</option>
                  <option value="7d">최근 7일</option>
                  <option value="30d">최근 30일</option>
                </select>
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="수신번호/내용 검색"
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void loadHistory(1)}
                  disabled={historyLoading}
                  className="rounded-lg border border-lime-300 bg-lime-50 px-4 py-2 text-sm font-semibold text-lime-800 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-lime-100"
                >
                  조회
                </button>
              </div>

              {historyError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {historyError}
                </p>
              )}

              <div className="max-h-[70vh] overflow-auto rounded-xl border border-stone-200">
                <table className="w-full min-w-[1320px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-stone-100 text-stone-700">
                    <tr>
                      <th className="border-b border-stone-200 px-3 py-2 text-left">일시</th>
                      <th className="border-b border-stone-200 px-3 py-2 text-left">채널</th>
                      <th className="border-b border-stone-200 px-3 py-2 text-left">템플릿 ID</th>
                      <th className="border-b border-stone-200 px-3 py-2 text-left">예약일시</th>
                      <th className="border-b border-stone-200 px-3 py-2 text-left">수신자</th>
                      <th className="border-b border-stone-200 px-3 py-2 text-left">수신번호</th>
                      <th className="border-b border-stone-200 px-3 py-2 text-left">내용</th>
                      <th className="border-b border-stone-200 px-3 py-2 text-left">상태</th>
                      <th className="border-b border-stone-200 px-3 py-2 text-left">실패사유</th>
                      <th className="border-b border-stone-200 px-3 py-2 text-left">접수번호</th>
                      <th className="border-b border-stone-200 px-3 py-2 text-left">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLoading ? (
                      <tr>
                        <td className="px-3 py-5 text-center text-stone-500" colSpan={11}>
                          발송 이력을 불러오는 중입니다...
                        </td>
                      </tr>
                    ) : historyItems.length === 0 ? (
                      <tr>
                        <td className="px-3 py-5 text-center text-stone-500" colSpan={11}>
                          발송 이력이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      historyItems.map((item) => (
                        <tr key={item.id} className="odd:bg-white even:bg-stone-50">
                          <td className="whitespace-nowrap border-t border-stone-100 px-3 py-2 text-stone-700">
                            {new Date(item.createdAt).toLocaleString("ko-KR")}
                          </td>
                          <td className="whitespace-nowrap border-t border-stone-100 px-3 py-2 text-stone-700">
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                                item.channel === "kakao"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-sky-100 text-sky-800"
                              }`}
                            >
                              {item.channel === "kakao" ? "카카오톡" : "문자"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap border-t border-stone-100 px-3 py-2 text-xs text-stone-500">
                            {item.templateId ?? "-"}
                          </td>
                          <td className="whitespace-nowrap border-t border-stone-100 px-3 py-2 text-stone-700">
                            {formatReserveForView(item.reserveDT)}
                          </td>
                          <td className="whitespace-nowrap border-t border-stone-100 px-3 py-2 text-stone-700">
                            {item.receiverName ?? "-"}
                          </td>
                          <td className="whitespace-nowrap border-t border-stone-100 px-3 py-2 text-stone-700">
                            {formatPhone(item.receiver)}
                          </td>
                          <td className="border-t border-stone-100 px-3 py-2 text-stone-700">
                            <p className="max-w-[520px] whitespace-pre-wrap break-words" title={item.content}>
                              {item.content}
                            </p>
                          </td>
                          <td className="whitespace-nowrap border-t border-stone-100 px-3 py-2">
                            {item.status === "success" ? (
                              <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                                성공
                              </span>
                            ) : item.status === "cancelled" ? (
                              <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                                예약취소
                              </span>
                            ) : (
                              <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                실패
                              </span>
                            )}
                          </td>
                          <td className="border-t border-stone-100 px-3 py-2 text-stone-700">
                            <p className="max-w-[360px] whitespace-pre-wrap break-words" title={item.errorMessage ?? "-"}>
                              {item.errorMessage ?? "-"}
                            </p>
                          </td>
                          <td className="whitespace-nowrap border-t border-stone-100 px-3 py-2 text-stone-700">
                            {item.receiptNum ?? "-"}
                          </td>
                          <td className="whitespace-nowrap border-t border-stone-100 px-3 py-2 text-stone-700">
                            {item.channel === "sms" && item.reserveDT && item.receiptNum && item.status === "success" ? (
                              <button
                                type="button"
                                onClick={() => setCancelTarget(item)}
                                className="rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                              >
                                예약 취소
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void loadHistory(Math.max(1, historyPage - 1))}
                  disabled={historyLoading || historyPage <= 1}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-stone-50"
                >
                  이전
                </button>
                <button
                  type="button"
                  onClick={() => void loadHistory(Math.min(historyTotalPages, historyPage + 1))}
                  disabled={historyLoading || historyPage >= historyTotalPages}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-stone-50"
                >
                  다음
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">예약 문자 취소 확인</h3>
            <p className="mt-2 text-sm text-stone-700">
              아래 예약 문자를 취소할까요?
            </p>
            <div className="mt-3 space-y-1 rounded-xl bg-stone-50 p-3 text-xs text-stone-700">
              <p>수신번호: {formatPhone(cancelTarget.receiver)}</p>
              <p>예약일시: {formatReserveForView(cancelTarget.reserveDT)}</p>
              <p className="whitespace-pre-wrap break-words">내용: {cancelTarget.content}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancelSubmitting}
                className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 disabled:opacity-60"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void cancelReserved(cancelTarget)}
                disabled={cancelSubmitting}
                className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {cancelSubmitting ? "취소 중..." : "예약 취소"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
