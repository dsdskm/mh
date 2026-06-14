"use client";

import { AdminShell } from "../_components/admin-shell";
import { useAdminPage } from "../_hooks/use-admin-page";
import { SettingsTab } from "./_components/settings-tab";

export default function SettingsPage() {
  const state = useAdminPage("기본정보");

  return (
    <AdminShell activeTab="기본정보" state={state}>
      <SettingsTab state={state} />
    </AdminShell>
  );
}
