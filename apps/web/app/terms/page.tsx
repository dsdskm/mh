import { headers } from "next/headers";
import { notFound } from "next/navigation";

async function resolveApiBaseUrl(): Promise<string> {
  const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || process.env.API_BASE_URL?.trim();
  if (configuredBase) {
    return configuredBase.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:9000";
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  if (!host) {
    return "";
  }

  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  return `${protocol}://${host}`;
}

type TermsConfig = {
  termsUrl: string;
};

async function loadTermsUrl(): Promise<string | null> {
  try {
    const apiBase = await resolveApiBaseUrl();
    if (!apiBase) {
      return null;
    }

    const response = await fetch(`${apiBase}/api/config`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Partial<TermsConfig>;
    const termsUrl = data.termsUrl?.trim();
    return termsUrl || null;
  } catch {
    return null;
  }
}

export default async function TermsPage() {
  const termsUrl = await loadTermsUrl();

  if (!termsUrl) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-3 px-3 py-4 sm:px-4 sm:py-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-900">
        <p className="font-semibold">본 서비스는 에이비에이테크(ABA TECH)가 운영합니다.</p>
        <p className="mt-1">운영 주체: 에이비에이테크(ABA TECH) | 대표: 김기훈 | 사업자등록번호: 179-73-00483</p>
      </section>
      <iframe
        src={termsUrl}
        title="이용약관"
        className="h-[88vh] w-full rounded-2xl border border-stone-200 bg-white sm:h-[85vh]"
      />
    </main>
  );
}
