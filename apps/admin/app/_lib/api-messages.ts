import { API_BASE } from './constants';
import { adminFetch, parseJsonOrThrow } from './api-common';
import type { AdminSmsHistoryPage } from './types';

export type SendAdminSmsPayload = {
  receiver: string;
  receiverName?: string;
  content: string;
  reserveDT?: string;
  adsYN?: boolean;
};

export type AdminKakaoTemplateKey =
  | 'orderCancelCompleted'
  | 'orderCancelRequested'
  | 'paymentConfirmed'
  | 'orderReceived'
  | 'authNumber'
  | 'signupWelcome'
  | 'deliveryStarted';

export type SendAdminKakaoTemplateTestPayload = {
  receiver: string;
  receiverName?: string;
  templateKey: AdminKakaoTemplateKey;
  variables: Record<string, string>;
};

export type SendAdminKakaoTemplateTestResult = {
  templateKey: AdminKakaoTemplateKey;
  templateId: string;
  receiptNum: string;
  fallbackUsed: boolean;
};

export async function sendAdminSmsApi(payload: SendAdminSmsPayload): Promise<{ receiptNum: string }> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/messages/sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<{ receiptNum: string }>(response, '발송에 실패했습니다.');
}

export async function sendAdminKakaoTemplateTestApi(
  payload: SendAdminKakaoTemplateTestPayload,
): Promise<SendAdminKakaoTemplateTestResult> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/messages/tests/kakao-template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseJsonOrThrow<SendAdminKakaoTemplateTestResult>(response, '카카오 템플릿 테스트 발송에 실패했습니다.');
}

export async function cancelAdminReservedSmsApi(historyId: number): Promise<{ ok: true }> {
  const response = await adminFetch(`${API_BASE}/api/backoffice/messages/reservations/${historyId}/cancel`, {
    method: 'POST',
  });

  return parseJsonOrThrow<{ ok: true }>(response, '예약 문자 취소에 실패했습니다.');
}

export async function fetchAdminSmsHistoryApi(
  page: number,
  pageSize: number,
  options?: {
    query?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): Promise<AdminSmsHistoryPage> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (options?.query) {
    query.set('q', options.query);
  }
  if (options?.dateFrom) {
    query.set('dateFrom', options.dateFrom);
  }
  if (options?.dateTo) {
    query.set('dateTo', options.dateTo);
  }

  const response = await adminFetch(`${API_BASE}/api/backoffice/messages/history?${query.toString()}`, {
    cache: 'no-store',
  });

  return parseJsonOrThrow<AdminSmsHistoryPage>(response, '발송 이력을 불러오지 못했습니다.');
}
