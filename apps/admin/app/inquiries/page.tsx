"use client";

import { AdminShell } from "../_components/admin-shell";
import { useAdminPage } from "../_hooks/use-admin-page";
import { InquiriesTab } from "./_components/inquiries-tab";

export default function InquiriesPage() {
  const state = useAdminPage("문의내역");

  return (
    <AdminShell activeTab="문의내역" state={state}>
      <InquiriesTab inquiries={state.inquiries} notifications={state.notifications} />
    </AdminShell>
  );
}
