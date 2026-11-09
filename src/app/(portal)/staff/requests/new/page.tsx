import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/require";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { NewRequestForm } from "@/components/requests/new-request-form";

export const metadata: Metadata = { title: "New document request" };

export default async function NewRequestPage(props: PageProps<"/staff/requests/new">) {
  const me = await requireRole("ADMIN", "STAFF");
  const sp = await props.searchParams;
  const [companies, documentTypes, reminderTypes] = await Promise.all([
    prisma.company.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ assignedStaffId: "asc" }, { name: "asc" }],
      include: { assignedStaff: { select: { name: true } }, _count: { select: { contacts: true } } },
    }),
    prisma.documentType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.reminderType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const mine = companies.filter((c) => c.assignedStaffId === me.id);
  const ordered = [...mine, ...companies.filter((c) => c.assignedStaffId !== me.id)];

  const ready = companies.length > 0 && documentTypes.length > 0 && reminderTypes.length > 0;

  return (
    <>
      <PageHeader title="New document request" description="Ask a client for a document. The schedule below is generated from the reminder rule you pick." />
      {!ready ? (
        <EmptyState
          title="Setup needed first"
          description="You need at least one active company, document type and reminder rule before creating a request."
          action={
            <Button asChild variant="outline">
              <Link href="/admin/companies">Go to setup</Link>
            </Button>
          }
        />
      ) : (
        <NewRequestForm
          initialCompanyId={typeof sp.company === "string" ? sp.company : undefined}
          companies={ordered.map((c) => ({ id: c.id, name: c.name, assignedStaff: c.assignedStaff?.name ?? null, contacts: c._count.contacts }))}
          documentTypes={documentTypes.map((d) => ({ id: d.id, name: d.name, description: d.description, acceptedExtensions: d.acceptedExtensions, maxSizeMb: d.maxSizeMb }))}
          reminderTypes={reminderTypes.map((r) => ({ id: r.id, name: r.name, channel: r.channel, daysBefore: r.daysBefore, repeatEveryDays: r.repeatEveryDays, escalateAfter: r.escalateAfter }))}
        />
      )}
    </>
  );
}
