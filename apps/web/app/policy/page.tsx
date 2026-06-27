import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9000";

type PolicyConfig = {
  shippingRefundPolicy?: string;
};

const FALLBACK_POLICY_TEXT = [
  "배송: 평일 오전 결제 확인 건은 당일 출고, 이후 건은 익일 출고합니다.",
  "배송비: 기본 3,500원이며 도서산간 지역은 추가 비용이 발생할 수 있습니다.",
  "취소: 상품 준비 전에는 취소 가능하며, 준비중 이후에는 고객센터 문의가 필요합니다.",
  "환불: 신선식품 특성상 단순 변심 환불은 어렵고, 오배송/하자 시 사진 첨부 후 처리합니다.",
  "문의: 문의하기 페이지를 통해 주문번호/연락처와 함께 접수해주세요.",
].join("\n");

async function loadPolicyText(): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/api/config`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return FALLBACK_POLICY_TEXT;
    }

    const data = (await response.json()) as PolicyConfig;
    const text = data.shippingRefundPolicy?.trim();
    return text || FALLBACK_POLICY_TEXT;
  } catch {
    return FALLBACK_POLICY_TEXT;
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
        <p className="mt-4 whitespace-pre-line text-sm leading-6">{policyText}</p>
      </section>
    </main>
  );
}
