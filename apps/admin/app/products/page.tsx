"use client";

import { AdminShell } from "../_components/admin-shell";
import { useAdminPage } from "../_hooks/use-admin-page";
import { ProductsTab } from "./_components/products-tab";

export default function ProductsPage() {
  const state = useAdminPage("상품관리");

  return (
    <AdminShell activeTab="상품관리" state={state}>
      <ProductsTab state={state} />
    </AdminShell>
  );
}
