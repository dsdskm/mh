import { formatCurrency } from "../../_lib/constants";
import { Dashboard } from "../../_lib/types";

type Props = {
  dashboard: Dashboard | null;
};

export function DashboardTab({ dashboard }: Props) {
  if (!dashboard) {
    return null;
  }

  return (
    <>
      <h2 className="font-display text-3xl text-lime-800">대시보드</h2>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="활성 상품" value={`${dashboard.totalProducts}`} />
        <MetricCard title="총 주문" value={`${dashboard.totalOrders}`} />
        <MetricCard title="총 매출" value={formatCurrency(dashboard.totalSales)} />
        <MetricCard title="접수" value={`${dashboard.receivedOrders}`} />
        <MetricCard title="입금 확인" value={`${dashboard.paidOrders}`} />
        <MetricCard title="상품 준비중" value={`${dashboard.preparingOrders}`} />
      </section>
    </>
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
