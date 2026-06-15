"use client";

import { AdminShell } from "../_components/admin-shell";
import { useAdminPage } from "../_hooks/use-admin-page";
import { RewardsTab } from "./_components/rewards-tab";

export default function RewardsPage() {
  const state = useAdminPage("쿠폰·적립금");

  return (
    <AdminShell activeTab="쿠폰·적립금" state={state}>
      <RewardsTab state={state} />
    </AdminShell>
  );
}
