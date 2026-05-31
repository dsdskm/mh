"use client";

import { AdminLogin } from "./_components/admin-login";
import { AdminSidebar } from "./_components/admin-sidebar";
import { AdminTabContent } from "./_components/admin-tab-content";
import { useAdminPage } from "./_hooks/use-admin-page";
import { TABS } from "./_lib/constants";

export default function AdminHome() {
  const state = useAdminPage();

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
    <main className="min-h-screen bg-admin-pattern px-4 pb-16 pt-6 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[240px_1fr]">
        <AdminSidebar
          tabs={TABS}
          activeTab={state.activeTab}
          onTabChange={state.setActiveTab}
          onLogout={state.logout}
        />

        <AdminTabContent state={state} />
      </div>
    </main>
  );
}
