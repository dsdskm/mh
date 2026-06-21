type ApiErrorBody = {
  message?: string;
};

type AdminFetchInit = RequestInit & {
  timeoutMs?: number;
};

const ADMIN_AUTH_TOKEN_KEY = "admin-access-token";

export function getAdminAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY);
  return token?.trim() || null;
}

export function setAdminAccessToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ADMIN_AUTH_TOKEN_KEY, token);
}

export function clearAdminAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY);
}

export async function adminFetch(url: string, init?: AdminFetchInit): Promise<Response> {
  const token = getAdminAccessToken();
  if (!token) {
    throw new Error("관리자 인증이 필요합니다. 다시 로그인해주세요.");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const timeoutMs = init?.timeoutMs ?? 30000;
  const controller = new AbortController();
  const baseSignal = init?.signal;

  if (baseSignal) {
    if (baseSignal.aborted) {
      controller.abort(baseSignal.reason);
    } else {
      baseSignal.addEventListener("abort", () => controller.abort(baseSignal.reason), {
        once: true,
      });
    }
  }

  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException("Request timeout", "AbortError"));
  }, timeoutMs);

  const { timeoutMs: _timeoutMs, signal: _signal, ...restInit } = init ?? {};

  let response: Response;
  try {
    response = await fetch(url, {
      ...restInit,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요. (URL: ${url})`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401) {
    clearAdminAccessToken();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("admin-authed");
    }

    throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
  }

  return response;
}

export async function parseJsonOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.message ?? fallbackMessage);
  }

  return (await response.json()) as T;
}
