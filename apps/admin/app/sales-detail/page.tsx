"use client";

import { AdminShell } from "../_components/admin-shell";
import { useAdminPage } from "../_hooks/use-admin-page";
import { SalesDetailTab } from "./_components/sales-detail-tab";

export default function SalesDetailPage() {
  const state = useAdminPage("매출 상세");

  return (
    <AdminShell activeTab="매출 상세" state={state}>
      <SalesDetailTab orders={state.orders} />
    </AdminShell>
  );
}
