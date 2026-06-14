"use client";

import { AdminShell } from "../_components/admin-shell";
import { useAdminPage } from "../_hooks/use-admin-page";
import { AccountsTab } from "./_components/accounts-tab";

export default function AccountsPage() {
  const state = useAdminPage("계정관리");

  return (
    <AdminShell activeTab="계정관리" state={state}>
      <AccountsTab
        accounts={state.accounts}
        createAccount={state.createAccount}
        updateAccount={state.updateAccount}
        deleteAccount={state.deleteAccount}
      />
    </AdminShell>
  );
}
