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

type PrivacyConfig = {
  privacyUrl?: string;
};

async function loadPrivacyUrl(): Promise<string | null> {
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

    const data = (await response.json()) as PrivacyConfig;
    const url = data.privacyUrl?.trim();
    return url || null;
  } catch {
    return null;
  }
}

export default async function PrivacyPolicyPage() {
  const privacyUrl = await loadPrivacyUrl();

  if (!privacyUrl) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      <iframe
        src={privacyUrl}
        title="개인정보처리방침"
        className="h-[88vh] w-full rounded-2xl border border-stone-200 bg-white sm:h-[85vh]"
      />
    </main>
  );
}
