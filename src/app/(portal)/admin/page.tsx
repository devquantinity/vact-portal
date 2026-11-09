import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Pending, overdue and awaiting-review requests across all companies." />
      <EmptyState title="Nothing to show yet" description="Metrics appear once document requests have been created." />
    </>
  );
}
