import { notFound } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9000";

type TermsConfig = {
  termsUrl: string;
};

async function loadTermsUrl(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/api/config`, {
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
    <main className="mx-auto min-h-screen w-full max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      <iframe
        src={termsUrl}
        title="이용약관"
        className="h-[88vh] w-full rounded-2xl border border-stone-200 bg-white sm:h-[85vh]"
      />
    </main>
  );
}
