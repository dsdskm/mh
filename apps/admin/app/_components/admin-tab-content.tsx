import {
  AccountsTab,
  InquiriesTab,
  NoticesTab,
  OrdersTab,
  ProductsTab,
  ReviewsTab,
  SalesDetailTab,
  SettingsTab,
} from "./tabs";
import { AdminPageState } from "../_hooks/use-admin-page";

type Props = {
  state: AdminPageState;
};

export function AdminTabContent({ state }: Props) {
  const { activeTab, loading, error, notice } = state;

  return (
    <section className="min-h-[calc(100vh-2rem)] space-y-4 rounded-3xl border border-lime-200 bg-white/95 p-5 shadow-xl">
      {loading && <p className="text-sm text-stone-600">데이터 불러오는 중...</p>}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

      {activeTab === "기본정보" && <SettingsTab state={state} />}
      {activeTab === "상품관리" && <ProductsTab state={state} />}
      {activeTab === "주문내역" && <OrdersTab orders={state.orders} updateOrderStatus={state.updateOrderStatus} />}
      {activeTab === "공지사항" && <NoticesTab />}
      {activeTab === "매출 상세" && <SalesDetailTab />}
      {activeTab === "문의내역" && <InquiriesTab inquiries={state.inquiries} />}
      {activeTab === "후기 목록" && <ReviewsTab reviews={state.reviews} />}
      {activeTab === "계정관리" && (
        <AccountsTab
          accounts={state.accounts}
          createAccount={state.createAccount}
          updateAccount={state.updateAccount}
          deleteAccount={state.deleteAccount}
        />
      )}
    </section>
  );
}
