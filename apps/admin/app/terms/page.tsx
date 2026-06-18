"use client";

import { AdminShell } from "../_components/admin-shell";
import { useAdminPage } from "../_hooks/use-admin-page";
import { TermsTab } from "./_components/terms-tab";

export default function TermsPage() {
  const state = useAdminPage("약관관리");

  return (
    <AdminShell activeTab="약관관리" state={state}>
      <TermsTab state={state} />
    </AdminShell>
  );
}
