"use client";

import { AdminShell } from "../_components/admin-shell";
import { useAdminPage } from "../_hooks/use-admin-page";
import { MessagesTab } from "./_components/messages-tab";

export default function MessagesPage() {
  const state = useAdminPage("문자전송");

  return (
    <AdminShell activeTab="문자전송" state={state}>
      <MessagesTab accounts={state.accounts} />
    </AdminShell>
  );
}
