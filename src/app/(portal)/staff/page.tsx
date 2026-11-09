import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Staff dashboard" };

export default function StaffDashboardPage() {
  return (
    <>
      <PageHeader title="My work" description="Uploads waiting for your review, overdue requests and escalations." />
      <EmptyState title="Nothing to show yet" description="Your queue appears once document requests have been created." />
    </>
  );
}
