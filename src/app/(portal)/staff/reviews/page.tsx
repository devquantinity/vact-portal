import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/require";
import { describeDaysLeft, formatDateTime, formatDueDate } from "@/lib/dates";
import { loadRequestDetail } from "@/lib/requests/detail";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LinkTabs } from "@/components/shared/link-tabs";
import { RequestStatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RequestTabs } from "@/components/requests/request-panel";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewsPage(props: PageProps<"/staff/reviews">) {
  const me = await requireRole("ADMIN", "STAFF");
  const sp = await props.searchParams;
  const scope = sp.scope === "all" ? "all" : "mine";
  const picked = typeof sp.request === "string" ? sp.request : undefined;

  const where = {
    status: "UPLOADED" as const,
    ...(scope === "mine" ? { company: { assignedStaffId: me.id } } : {}),
  };
  const [rows, mineCount, allCount] = await Promise.all([
    prisma.documentRequest.findMany({
      where,
      include: {
        company: { select: { id: true, name: true, assignedStaff: { select: { name: true } } } },
        documentType: { select: { name: true } },
        documents: { where: { reviewStatus: "AWAITING" }, orderBy: { uploadedAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
      },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.documentRequest.count({ where: { status: "UPLOADED", company: { assignedStaffId: me.id } } }),
    prisma.documentRequest.count({ where: { status: "UPLOADED" } }),
  ]);

  // The oldest upload opens by default, so the queue can be worked straight through.
  const selectedId = picked ?? rows[0]?.id;
  const selected = selectedId ? await loadRequestDetail(selectedId, me.id) : null;
  const base = `/staff/reviews?scope=${scope}`;
  const hrefFor = (id: string) => `${base}&request=${id}`;
  // After a decision, move on to the next upload in the list (or the one before it at the end).
  const index = rows.findIndex((r) => r.id === selectedId);
  const nextId = index >= 0 ? (rows[index + 1]?.id ?? rows[index - 1]?.id) : rows[0]?.id;
  const afterReviewHref = nextId && nextId !== selectedId ? hrefFor(nextId) : base;

  return (
    <>
      <PageHeader title="Review queue" description="Uploads waiting for a decision. Approve, or request changes with a comment the client will see." />
      <LinkTabs
        current={scope}
        hrefFor={(k) => `/staff/reviews?scope=${k}`}
        tabs={[
          { key: "mine", label: "My companies", count: mineCount },
          { key: "all", label: "All companies", count: allCount },
        ]}
      />
      {rows.length === 0 && !selected ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing to review"
          description={scope === "mine" ? "No uploads are waiting on your companies. Switch to All companies to help a colleague." : "Every upload has been reviewed."}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* On a phone an opened upload takes the whole width; the list comes back with "All uploads". */}
          <nav aria-label="Uploads waiting for review" className={cn("lg:sticky lg:top-8", picked && "hidden lg:block")}>
            <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {rows.length} waiting · oldest first
            </p>
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Nothing else waiting.</p>
            ) : (
              <ul className="space-y-2 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-1">
                {rows.map((r) => {
                  const latest = r.documents[0];
                  const active = r.id === selectedId;
                  return (
                    <li key={r.id}>
                      <Link
                        href={hrefFor(r.id)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "block rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary/60",
                          active && "border-primary ring-2 ring-primary/20",
                        )}
                      >
                        <span className="block truncate text-sm font-semibold">{r.company.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <FileText className="size-3.5 shrink-0" />
                          <span className="truncate">{r.documentType.name}</span>
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <Badge variant="uploaded">
                            {r.documents.length} file{r.documents.length === 1 ? "" : "s"}
                          </Badge>
                          {latest ? <span>{formatDateTime(latest.uploadedAt)}</span> : null}
                          <span>· due {formatDueDate(r.dueDate)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>

          {selected ? (
            <Card className="gap-0 py-0">
              <div className="border-b px-5 py-4 sm:px-6">
                {picked ? (
                  <Link href={base} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:hidden">
                    <ArrowLeft className="size-4" /> All uploads
                  </Link>
                ) : null}
                <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  {selected.documentType.name}
                  <RequestStatusBadge status={selected.status} overdue={selected.overdue} />
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  <Link href={`/staff/companies/${selected.company.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                    {selected.company.name}
                  </Link>{" "}
                  · due {selected.dueDateLabel} ({describeDaysLeft(selected.daysLeft)}) · officer {selected.company.assignedStaff ?? "unassigned"}
                </p>
              </div>
              <div className="px-5 py-5 sm:px-6">
                <RequestTabs key={selected.id} request={selected} afterReviewHref={afterReviewHref} />
              </div>
            </Card>
          ) : (
            <EmptyState compact title="Upload not found" description="It may have been removed. Pick another upload from the list." />
          )}
        </div>
      )}
    </>
  );
}
