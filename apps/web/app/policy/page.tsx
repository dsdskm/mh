import Link from "next/link";

export default function PolicyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-4 py-6 text-stone-800">
      <Link href="/" className="text-sm font-semibold text-amber-700">
        ← 홈으로
      </Link>

      <section className="rounded-3xl border border-amber-200 bg-white p-5 shadow">
        <h1 className="font-display text-3xl text-amber-800">배송/환불 정책</h1>
        <div className="mt-4 space-y-3 text-sm leading-6">
          <p>
            <strong>배송:</strong> 평일 오전 결제 확인 건은 당일 출고, 이후 건은 익일 출고합니다.
          </p>
          <p>
            <strong>배송비:</strong> 기본 3,500원이며 도서산간 지역은 추가 비용이 발생할 수 있습니다.
          </p>
          <p>
            <strong>취소:</strong> 상품 준비 전에는 취소 가능하며, 준비중 이후에는 고객센터 문의가 필요합니다.
          </p>
          <p>
            <strong>환불:</strong> 신선식품 특성상 단순 변심 환불은 어렵고, 오배송/하자 시 사진 첨부 후 처리합니다.
          </p>
          <p>
            <strong>문의:</strong> 문의하기 페이지를 통해 주문번호/연락처와 함께 접수해주세요.
          </p>
        </div>
      </section>
    </main>
  );
}
