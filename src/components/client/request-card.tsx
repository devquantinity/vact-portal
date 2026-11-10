import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight, Clock, FileText, Hourglass, MessageSquareWarning, Paperclip, Upload } from "lucide-react";
import type { ClientRequestRow } from "@/lib/requests/client-queries";
import { describeDaysLeft, formatDueDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { RequestStatusBadge } from "@/components/shared/status-badge";

/**
 * One request in the client's list. Pending items get a strong due-date line and an Upload action;
 * waiting / completed items stay compact.
 */
export function ClientRequestCard({ r }: { r: ClientRequestRow }) {
  const href = `/client/requests/${r.id}`;
  const needsAction = r.status === "PENDING" || r.status === "CHANGES_REQUESTED";
  const urgent = r.status === "PENDING" && r.daysLeft <= 3;

  const accent = r.overdue
    ? "border-l-red-500"
    : r.status === "CHANGES_REQUESTED"
      ? "border-l-orange-400"
      : urgent
        ? "border-l-amber-400"
        : r.status === "PENDING"
          ? "border-l-slate-300"
          : r.status === "UPLOADED"
            ? "border-l-amber-300"
            : "border-l-emerald-400";

  const Icon = r.status === "APPROVED" ? CheckCircle2 : r.status === "UPLOADED" ? Hourglass : r.status === "CHANGES_REQUESTED" ? MessageSquareWarning : FileText;
  const iconTone =
    r.status === "APPROVED"
      ? "bg-emerald-50 text-emerald-600"
      : r.status === "UPLOADED"
        ? "bg-amber-50 text-amber-600"
        : r.status === "CHANGES_REQUESTED"
          ? "bg-orange-50 text-orange-600"
          : r.overdue
            ? "bg-red-50 text-red-600"
            : "bg-sky-50 text-sky-600";

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-l-4 bg-card py-3.5 pl-3.5 pr-3 shadow-xs transition-all hover:-translate-y-px hover:border-primary/50 hover:shadow-sm active:translate-y-0 sm:gap-4 sm:py-4 sm:pl-4 sm:pr-4",
        accent,
        r.overdue && "bg-red-50/30",
      )}
    >
      <span className={cn("hidden size-10 shrink-0 items-center justify-center rounded-lg sm:flex", iconTone)}>
        <Icon className="size-5" />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-display text-[15px] font-semibold leading-tight tracking-tight sm:text-base">{r.documentType}</p>
          <RequestStatusBadge status={r.status} overdue={r.overdue} />
        </div>

        {r.status === "PENDING" ? (
          <p className={cn("flex items-center gap-1.5 text-sm", r.overdue ? "font-medium text-red-700" : urgent ? "font-medium text-amber-700" : "text-muted-foreground")}>
            <Clock className="size-3.5 shrink-0" />
            <span>
              Due {formatDueDate(r.dueDate)} <span className="mx-1 text-muted-foreground/60">·</span> {describeDaysLeft(r.daysLeft)}
            </span>
          </p>
        ) : r.status === "CHANGES_REQUESTED" ? (
          <p className="text-sm text-orange-900/90 line-clamp-2">
            <span className="font-medium">V ACT:</span> “{r.latestComment ?? "a correction is needed"}”
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Paperclip className="size-3.5 shrink-0" />
            {r.filesCount} file{r.filesCount === 1 ? "" : "s"}
            <span className="text-muted-foreground/60">·</span> due {formatDueDate(r.dueDate)}
          </p>
        )}
      </div>

      {needsAction ? (
        <>
          <span
            className={cn(
              "hidden shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors sm:inline-flex",
              r.status === "CHANGES_REQUESTED" ? "bg-orange-500 group-hover:bg-orange-600" : r.overdue ? "bg-red-600 group-hover:bg-red-700" : "bg-primary group-hover:bg-primary/90",
            )}
          >
            <Upload className="size-4" /> {r.status === "CHANGES_REQUESTED" ? "Upload corrected file" : "Upload"}
          </span>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground sm:hidden" />
        </>
      ) : (
        <ChevronRight className="size-5 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" />
      )}
    </Link>
  );
}
