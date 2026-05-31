import { FormEvent } from "react";
import { formatCurrency, formatPhone, STATUS_OPTIONS } from "../_lib/constants";
import { AdminPageState } from "../_hooks/use-admin-page";

type Props = {
  state: AdminPageState;
};

export function AdminTabContent({ state }: Props) {
  const {
    activeTab,
    dashboard,
    loading,
    error,
    notice,
    saveConfig,
    shopName,
    sellerName,
    sellerPhone,
    origin,
    bankName,
    accountNumber,
    accountHolder,
    videoUrl,
    transferNote,
    detailDescription,
    setShopName,
    setSellerName,
    setSellerPhone,
    setOrigin,
    setBankName,
    setAccountNumber,
    setAccountHolder,
    setVideoUrl,
    setTransferNote,
    setDetailDescription,
    submitProduct,
    newName,
    newDescription,
    newPrice,
    newStock,
    newImageUrl,
    newBadge,
    setNewName,
    setNewDescription,
    setNewPrice,
    setNewStock,
    setNewImageUrl,
    setNewBadge,
    products,
    orders,
    updateOrderStatus,
    inquiries,
    reviews,
  } = state;

  return (
    <section className="space-y-4 rounded-3xl border border-lime-200 bg-white/95 p-5 shadow-xl">
      {loading && <p className="text-sm text-stone-600">데이터 불러오는 중...</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

      {activeTab === "대시보드" && dashboard && (
        <>
          <h2 className="font-display text-3xl text-lime-800">대시보드</h2>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="활성 상품" value={`${dashboard.totalProducts}`} />
            <MetricCard title="총 주문" value={`${dashboard.totalOrders}`} />
            <MetricCard title="총 매출" value={formatCurrency(dashboard.totalSales)} />
            <MetricCard title="접수" value={`${dashboard.pendingTransfers}`} />
            <MetricCard title="준비중" value={`${dashboard.preparing}`} />
          </section>
        </>
      )}

      {activeTab === "기본정보" && (
        <>
          <h2 className="font-display text-3xl text-lime-800">기본정보</h2>
          <form onSubmit={saveConfig} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">상점명</span>
                <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="상점명" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">판매자명</span>
                <input value={sellerName} onChange={(e) => setSellerName(e.target.value)} placeholder="판매자명" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">연락처</span>
                <input value={sellerPhone} onChange={(e) => setSellerPhone(e.target.value)} placeholder="연락처" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">원산지</span>
                <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="원산지" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">은행명</span>
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="은행명" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">계좌번호</span>
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="계좌번호" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">예금주</span>
                <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="예금주" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">영상 URL</span>
                <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="영상 URL" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-stone-600">입금 안내</span>
              <textarea value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="입금 안내" className="h-20 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-stone-600">상품 상세 설명</span>
              <textarea value={detailDescription} onChange={(e) => setDetailDescription(e.target.value)} placeholder="상품 상세 설명" className="h-28 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
            </label>
            <button type="submit" className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white">기본정보 저장</button>
          </form>
        </>
      )}

      {activeTab === "상품관리" && (
        <>
          <h2 className="font-display text-3xl text-lime-800">상품관리</h2>
          <form onSubmit={submitProduct} className="space-y-3 rounded-2xl border border-lime-200 p-4">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-stone-600">상품명</span>
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="상품명"
                className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-stone-600">상품 설명</span>
              <textarea
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="상품 설명"
                className="h-20 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">가격</span>
                <input value={newPrice} onChange={(event) => setNewPrice(event.target.value)} placeholder="가격" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-stone-600">재고</span>
                <input value={newStock} onChange={(event) => setNewStock(event.target.value)} placeholder="재고" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-stone-600">이미지 URL</span>
              <input value={newImageUrl} onChange={(event) => setNewImageUrl(event.target.value)} placeholder="이미지 URL" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-stone-600">배지</span>
              <input value={newBadge} onChange={(event) => setNewBadge(event.target.value)} placeholder="배지" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" required />
            </label>
            <button type="submit" className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white">상품 등록</button>
          </form>
          <div className="grid gap-2">
            {products.map((product) => (
              <div key={product.id} className="rounded-xl border border-stone-200 p-3 text-sm">
                <p className="font-semibold">{product.name}</p>
                <p className="text-xs text-stone-600">{formatCurrency(product.price)} · 재고 {product.stock} · {product.badge}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === "주문내역" && (
        <>
          <h2 className="font-display text-3xl text-lime-800">주문내역</h2>
          <div className="space-y-3">
            {orders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-stone-900">{order.id}</p>
                    <p className="text-xs text-stone-600">{order.customerName} · {formatPhone(order.phone)} · 입금자 {order.depositorName}</p>
                    <p className="text-sm font-semibold text-amber-700">{formatCurrency(order.totalAmount)}</p>
                  </div>
                  <select
                    value={order.status}
                    onChange={(event) => void updateOrderStatus(order.id, event.target.value as any)}
                    aria-label="주문 상태"
                    className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {activeTab === "문의내역" && (
        <>
          <h2 className="font-display text-3xl text-lime-800">문의내역</h2>
          <div className="space-y-3">
            {inquiries.map((inquiry) => (
              <article key={inquiry.id} className="rounded-2xl border border-stone-200 p-4">
                <p className="text-sm font-bold text-stone-900">{inquiry.title}</p>
                <p className="text-xs text-stone-600">{inquiry.name} · {formatPhone(inquiry.phone)}</p>
                <p className="mt-2 text-sm text-stone-800">{inquiry.message}</p>
              </article>
            ))}
          </div>
        </>
      )}

      {activeTab === "후기 목록" && (
        <>
          <h2 className="font-display text-3xl text-lime-800">후기 목록</h2>
          <div className="space-y-3">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-stone-200 p-4">
                <p className="text-sm font-bold text-stone-900">{review.name}</p>
                <p className="mt-1 text-sm text-stone-800">{review.content}</p>
                {review.comments.length > 0 && (
                  <div className="mt-2 space-y-1 rounded-xl bg-stone-50 p-2">
                    {review.comments.map((comment) => (
                      <p key={comment.id} className="text-xs text-stone-700">ㄴ {comment.name}: {comment.content}</p>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {activeTab === "계정관리" && (
        <>
          <h2 className="font-display text-3xl text-lime-800">계정관리</h2>
          <div className="rounded-2xl border border-stone-200 p-4 text-sm">
            <p className="font-semibold text-stone-900">인증 비활성화 상태</p>
            <p className="mt-1 text-stone-700">현재 어드민 앱은 로그인 없이 바로 접속됩니다.</p>
          </div>
        </>
      )}
    </section>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-2xl border border-lime-200 bg-white p-4 shadow-md">
      <p className="text-xs uppercase tracking-[0.15em] text-stone-500">{title}</p>
      <p className="mt-1 text-2xl font-extrabold text-lime-700">{value}</p>
    </article>
  );
}
