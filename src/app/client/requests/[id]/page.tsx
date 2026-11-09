import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Download, FileText, Info, MessageSquareWarning } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole, canAccessCompany } from "@/lib/auth/require";
import { daysLeft, describeDaysLeft, formatDateTime, formatDueDate, isOverdue } from "@/lib/dates";
import { signedFileUrl } from "@/lib/files/signed-url";
import { formatBytes } from "@/lib/utils";
import { formatPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequestStatusBadge, ReviewStatusBadge } from "@/components/shared/status-badge";
import { FileUploader } from "@/components/requests/file-uploader";

export const metadata: Metadata = { title: "Document request" };

export default async function ClientRequestPage(props: PageProps<"/client/requests/[id]">) {
  const me = await requireRole("CLIENT");
  const { id } = await props.params;
  const r = await prisma.documentRequest.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, assignedStaff: { select: { name: true, phone: true } } } },
      documentType: true,
      documents: { orderBy: { version: "desc" }, include: { reviewedBy: { select: { name: true } }, uploadedBy: { select: { name: true } } } },
    },
  });
  if (!r || r.status === "CANCELLED") notFound();
  if (!(await canAccessCompany(me, r.companyId))) notFound();

  const now = new Date();
  const overdue = r.status === "PENDING" && isOverdue(r.dueDate, now);
  const dl = daysLeft(r.dueDate, now);
  const canUpload = r.status === "PENDING" || r.status === "CHANGES_REQUESTED" || r.status === "UPLOADED";
  const latestChange = r.documents.find((d) => d.reviewStatus === "CHANGES_REQUESTED" && d.reviewComment);
  const officer = r.company.assignedStaff;

  return (
    <div className="space-y-6">
      <Link href={`/client?company=${r.company.id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="size-4" /> All documents
      </Link>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{r.documentType.name}</h1>
          <RequestStatusBadge status={r.status} overdue={overdue} />
        </div>
        <p className="text-sm text-muted-foreground">{r.company.name}</p>
        {r.status === "PENDING" ? (
          <p className={`flex items-center gap-1.5 text-sm font-medium ${overdue ? "text-destructive" : dl <= 3 ? "text-amber-700" : "text-foreground"}`}>
            <Clock className="size-4" /> Due {formatDueDate(r.dueDate)} · {describeDaysLeft(dl)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Due {formatDueDate(r.dueDate)}</p>
        )}
      </div>

      {r.documentType.description || r.instructions ? (
        <div className="space-y-2 rounded-xl border bg-card p-4 text-sm shadow-xs">
          {r.documentType.description ? (
            <p className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" /> <span>{r.documentType.description}</span>
            </p>
          ) : null}
          {r.instructions ? (
            <div className="rounded-lg bg-accent/60 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note from {officer?.name ?? "V ACT"}</p>
              <p className="whitespace-pre-wrap">{r.instructions}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {r.status === "CHANGES_REQUESTED" && latestChange ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
          <p className="mb-1 flex items-center gap-2 font-semibold">
            <MessageSquareWarning className="size-4" /> V ACT needs a correction
          </p>
          <p className="whitespace-pre-wrap">“{latestChange.reviewComment}”</p>
          <p className="mt-1 text-xs text-orange-800">
            {latestChange.reviewedBy?.name ?? "V ACT"}, {latestChange.reviewedAt ? formatDateTime(latestChange.reviewedAt) : ""}. Upload a corrected version below.
          </p>
        </div>
      ) : null}

      {r.status === "APPROVED" ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="size-5" /> Approved. Nothing more is needed for this document.
        </div>
      ) : null}

      {r.status === "UPLOADED" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Received. {officer?.name ?? "V ACT"} will review it and let you know by email{officer?.phone ? " or WhatsApp" : ""}.
        </div>
      ) : null}

      {canUpload ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">{r.status === "CHANGES_REQUESTED" ? "Upload a corrected version" : r.documents.length ? "Upload another file" : "Upload"}</h2>
          <FileUploader
            requestId={r.id}
            acceptedExtensions={r.documentType.acceptedExtensions}
            maxSizeMb={r.documentType.maxSizeMb}
            multiple={r.documentType.allowMultipleFiles}
          />
        </section>
      ) : null}

      {r.documents.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Your files</h2>
          <ul className="space-y-2">
            {r.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs">
                <FileText className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.originalName}</p>
                  <p className="text-xs text-muted-foreground">
                    v{d.version} · {formatBytes(d.sizeBytes)} · {formatDateTime(d.uploadedAt)}
                    {d.uploadedByRole === "STAFF" ? ` · uploaded by ${d.uploadedBy.name} (V ACT)` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <ReviewStatusBadge status={d.reviewStatus} />
                    {d.version !== r.documents[0].version ? <Badge variant="outline" className="text-muted-foreground">Previous version</Badge> : null}
                  </div>
                </div>
                <Button asChild variant="ghost" size="icon" aria-label={`Download ${d.originalName}`}>
                  <a href={signedFileUrl(d.id, me.id, { download: true })}>
                    <Download />
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Questions? {officer ? `${officer.name}${officer.phone ? ` · ${formatPhone(officer.phone)}` : ""}` : "Call the V ACT office."}
      </p>
    </div>
  );
}
