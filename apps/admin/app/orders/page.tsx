"use client";

import { AdminShell } from "../_components/admin-shell";
import { useAdminPage } from "../_hooks/use-admin-page";
import { OrdersTab } from "./_components/orders-tab";

export default function OrdersPage() {
  const state = useAdminPage("주문내역");

  return (
    <AdminShell activeTab="주문내역" state={state}>
      <OrdersTab
        orders={state.orders}
        products={state.products}
        updateOrderStatus={state.updateOrderStatus}
        createOrder={state.createOrder}
        updateOrder={state.updateOrder}
      />
    </AdminShell>
  );
}
