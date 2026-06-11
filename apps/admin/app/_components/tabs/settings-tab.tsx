import { AdminPageState } from "../../_hooks/use-admin-page";

type Props = {
  state: AdminPageState;
};

export function SettingsTab({ state }: Props) {
  return (
    <>
      <h2 className="font-display text-3xl text-lime-800">기본정보</h2>
      <form onSubmit={state.saveConfig} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">상점명</span>
            <input value={state.shopName} onChange={(e) => state.setShopName(e.target.value)} placeholder="상점명" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">판매자명</span>
            <input value={state.sellerName} onChange={(e) => state.setSellerName(e.target.value)} placeholder="판매자명" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">연락처</span>
            <input value={state.sellerPhone} onChange={(e) => state.setSellerPhone(e.target.value)} placeholder="연락처" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">원산지</span>
            <input value={state.origin} onChange={(e) => state.setOrigin(e.target.value)} placeholder="원산지" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">은행명</span>
            <input value={state.bankName} onChange={(e) => state.setBankName(e.target.value)} placeholder="은행명" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">계좌번호</span>
            <input value={state.accountNumber} onChange={(e) => state.setAccountNumber(e.target.value)} placeholder="계좌번호" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">예금주</span>
            <input value={state.accountHolder} onChange={(e) => state.setAccountHolder(e.target.value)} placeholder="예금주" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-stone-600">영상 URL</span>
            <input value={state.videoUrl} onChange={(e) => state.setVideoUrl(e.target.value)} placeholder="영상 URL" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-stone-600">입금 안내</span>
          <textarea value={state.transferNote} onChange={(e) => state.setTransferNote(e.target.value)} placeholder="입금 안내" className="h-20 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-stone-600">상품 상세 설명</span>
          <textarea value={state.detailDescription} onChange={(e) => state.setDetailDescription(e.target.value)} placeholder="상품 상세 설명" className="h-28 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded-xl bg-lime-600 px-4 py-2 text-sm font-bold text-white">기본정보 저장</button>
      </form>
    </>
  );
}
