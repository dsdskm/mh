"use client";

import { AdminShell } from "../_components/admin-shell";
import { useAdminPage } from "../_hooks/use-admin-page";
import { RecipesTab } from "./_components/recipes-tab";

export default function RecipesPage() {
  const state = useAdminPage("레시피관리");

  return (
    <AdminShell activeTab="레시피관리" state={state}>
      <RecipesTab state={state} />
    </AdminShell>
  );
}
