"use client";

import { AdminLogin } from "./admin-login";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTabContent } from "./admin-tab-content";
import { useAdminPage } from "../_hooks/use-admin-page";
import { TABS } from "../_lib/constants";
import { AdminTab } from "../_lib/types";

type Props = {
  activeTab: AdminTab;
};

export function AdminHome({ activeTab }: Props) {
  const state = useAdminPage(activeTab);

  if (!state.isAuthed) {
    return (
      <AdminLogin
        userId={state.loginUserId}
        password={state.loginPassword}
        error={state.loginError}
        onUserIdChange={state.setLoginUserId}
        onPasswordChange={state.setLoginPassword}
        onSubmit={state.submitLogin}
      />
    );
  }

  return (
    <main className="min-h-screen bg-admin-pattern px-3 pb-10 pt-4 text-stone-900 sm:px-4 lg:px-6">
      <div className="grid w-full items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <AdminSidebar
          tabs={TABS}
          activeTab={state.activeTab}
          onLogout={state.logout}
        />

        <AdminTabContent state={state} />
      </div>
    </main>
  );
}
