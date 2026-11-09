import Link from "next/link";
import { ChevronRight, Clock, Paperclip } from "lucide-react";
import type { ClientRequestRow } from "@/lib/requests/client-queries";
import { describeDaysLeft, formatDueDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { RequestStatusBadge } from "@/components/shared/status-badge";

export function ClientRequestCard({ r }: { r: ClientRequestRow }) {
  const urgent = r.status === "PENDING" && r.daysLeft <= 3;
  return (
    <Link
      href={`/client/requests/${r.id}`}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-xs transition-colors hover:border-primary/60 active:bg-accent/40",
        r.overdue && "border-red-200",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium leading-tight">{r.documentType}</p>
          <RequestStatusBadge status={r.status} overdue={r.overdue} />
        </div>
        {r.status === "PENDING" ? (
          <p className={cn("flex items-center gap-1.5 text-sm", r.overdue ? "text-destructive font-medium" : urgent ? "text-amber-700" : "text-muted-foreground")}>
            <Clock className="size-3.5" /> Due {formatDueDate(r.dueDate)} · {describeDaysLeft(r.daysLeft)}
          </p>
        ) : r.status === "CHANGES_REQUESTED" && r.latestComment ? (
          <p className="text-sm text-orange-800 line-clamp-2">V ACT: “{r.latestComment}”</p>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Paperclip className="size-3.5" /> {r.filesCount} file{r.filesCount === 1 ? "" : "s"} · due {formatDueDate(r.dueDate)}
          </p>
        )}
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
