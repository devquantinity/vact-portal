import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "My documents" };

export default function ClientHomePage() {
  return (
    <>
      <PageHeader title="My documents" description="What V ACT needs from your company and what is already approved." />
      <EmptyState title="No document requests yet" description="When V ACT asks for a document it will appear here." />
    </>
  );
}
