import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/require";
import { describeDaysLeft } from "@/lib/dates";
import { loadRequestDetail } from "@/lib/requests/detail";
import { RequestStatusBadge } from "@/components/shared/status-badge";
import { RequestView } from "@/components/requests/request-view";

export async function generateMetadata(props: PageProps<"/staff/requests/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const r = await prisma.documentRequest.findUnique({
    where: { id },
    select: { documentType: { select: { name: true } }, company: { select: { name: true } } },
  });
  return { title: r ? `${r.documentType.name} · ${r.company.name}` : "Request" };
}

/** One document request on its own page (replaces the old dialog on the company page). */
export default async function StaffRequestPage(props: PageProps<"/staff/requests/[id]">) {
  const me = await requireRole("ADMIN", "STAFF");
  const { id } = await props.params;
  const sp = await props.searchParams;
  const request = await loadRequestDetail(id, me.id);
  if (!request) notFound();

  const companyHref = `${me.role === "ADMIN" ? "/admin" : "/staff"}/companies/${request.company.id}?tab=requests`;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={companyHref} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {request.company.name}
      </Link>
      <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
        {request.documentType.name}
        <RequestStatusBadge status={request.status} overdue={request.overdue} />
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Due {request.dueDateLabel}
        {request.status === "PENDING" || request.status === "CHANGES_REQUESTED" ? ` (${describeDaysLeft(request.daysLeft)})` : ""} · Officer{" "}
        {request.company.assignedStaff ?? "not assigned"}
      </p>

      {sp.created ? (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-950">
          <CheckCircle2 className="size-4 shrink-0" /> Request created. The client has been told, and the reminders below are planned.
        </p>
      ) : null}

      <div className="mt-8">
        <RequestView key={request.id} request={request} />
      </div>
    </div>
  );
}
