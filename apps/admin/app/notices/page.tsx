"use client";

import { AdminShell } from "../_components/admin-shell";
import { useAdminPage } from "../_hooks/use-admin-page";
import { NoticesTab } from "./_components/notices-tab";

export default function NoticesPage() {
  const state = useAdminPage("공지사항");

  return (
    <AdminShell activeTab="공지사항" state={state}>
      <NoticesTab />
    </AdminShell>
  );
}
