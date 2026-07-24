import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || (process.env.NODE_ENV === "development" ? "http://localhost:9000" : "");

type PolicyConfig = {
  shippingRefundPolicy?: string;
};

async function loadPolicyText(): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/api/config`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return "";
    }

    const data = (await response.json()) as PolicyConfig;
    const text = data.shippingRefundPolicy?.trim();
    return text || "";
  } catch {
    return "";
  }
}

export default async function PolicyPage() {
  const policyText = await loadPolicyText();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-4 py-6 text-stone-800">
      <Link href="/" className="text-sm font-semibold text-amber-700">
        ← 홈으로
      </Link>

      <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow">
        <h1 className="font-display text-3xl text-amber-800">배송/환불 정책</h1>
        {policyText ? (
          <p className="mt-4 whitespace-pre-line text-sm leading-6">{policyText}</p>
        ) : (
          <p className="mt-4 text-sm leading-6 text-stone-500">등록된 배송/환불 정책이 없습니다.</p>
        )}
      </section>
    </main>
  );
}
