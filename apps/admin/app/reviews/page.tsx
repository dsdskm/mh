"use client";

import { AdminShell } from "../_components/admin-shell";
import { useAdminPage } from "../_hooks/use-admin-page";
import { ReviewsTab } from "./_components/reviews-tab";

export default function ReviewsPage() {
  const state = useAdminPage("후기");

  return (
    <AdminShell activeTab="후기" state={state}>
      <ReviewsTab reviews={state.reviews} />
    </AdminShell>
  );
}
