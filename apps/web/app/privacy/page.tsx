import { notFound } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "");

type PrivacyConfig = {
  privacyUrl?: string;
};

async function loadPrivacyUrl(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/api/config`, {
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
