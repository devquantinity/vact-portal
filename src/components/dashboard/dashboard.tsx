import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, TriangleAlert } from "lucide-react";
import { daysLeft, describeDaysLeft, formatDateTime, formatDueDate } from "@/lib/dates";
import type { awaitingReviewRequests, DashboardMetrics, dueSoonRequests, openEscalations, overdueRequests } from "@/lib/dashboard/queries";
import { cn } from "@/lib/utils";

type ReviewRows = Awaited<ReturnType<typeof awaitingReviewRequests>>;
type RequestRows = Awaited<ReturnType<typeof overdueRequests>> | Awaited<ReturnType<typeof dueSoonRequests>>;
type EscalationRows = Awaited<ReturnType<typeof openEscalations>>;

/** Rows shown before "Show N more". */
const VISIBLE = 5;

/**
 * The admin and staff home: four counts, then short lists of what needs doing. Built from plain rows rather than
 * tables so it reads the same on a phone.
 */
export function Dashboard({
  metrics,
  review,
  overdue,
  dueSoon,
  escalations,
  showOfficer,
  reviewHref,
  messagesHref,
  now,
}: {
  metrics: DashboardMetrics;
  review: ReviewRows;
  overdue: RequestRows;
  dueSoon: RequestRows;
  escalations: EscalationRows;
  showOfficer: boolean;
  /** The review queue with the same scope, e.g. /staff/reviews?scope=all */
  reviewHref: string;
  messagesHref?: string;
  now: Date;
}) {
  const nothingToDo = review.length + overdue.length + dueSoon.length + escalations.length === 0;

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="To review" value={metrics.awaitingReview} icon={ClipboardCheck} tone="amber" href={reviewHref} />
        <Tile label="Overdue" value={metrics.overdue} icon={TriangleAlert} tone="red" href={overdue.length ? "#overdue" : undefined} />
        <Tile label="Escalated" value={metrics.openEscalations} icon={AlertTriangle} tone="orange" href={escalations.length ? "#escalated" : undefined} />
        <Tile label="Due this week" value={dueSoon.length} icon={CalendarClock} tone="sky" href={dueSoon.length ? "#due-soon" : undefined} />
      </div>

      {nothingToDo ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-6 text-sm">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <span>
            <span className="font-semibold">All clear.</span> Nothing to review, nothing overdue, nothing due this week.
          </span>
        </div>
      ) : null}

      {review.length ? (
        <Section id="review" title="Needs your review" more={{ href: reviewHref, label: "Open the review queue" }}>
          {review.map((r) => (
            <Row
              key={r.id}
              href={`${reviewHref}&request=${r.id}`}
              company={r.company.name}
              document={r.documentType.name}
              officer={showOfficer ? r.company.assignedStaff?.name : undefined}
              badge={{ text: r.documents[0] ? `Uploaded ${formatDateTime(r.documents[0].uploadedAt, "d MMM")}` : "Uploaded", tone: "amber" }}
            />
          ))}
        </Section>
      ) : null}

      {overdue.length ? (
        <Section id="overdue" title="Overdue" hint="Reminders keep going until the client uploads.">
          {overdue.map((r) => (
            <Row
              key={r.id}
              href={`/staff/requests/${r.id}`}
              company={r.company.name}
              document={r.documentType.name}
              officer={showOfficer ? r.company.assignedStaff?.name : undefined}
              badge={{ text: describeDaysLeft(daysLeft(r.dueDate, now)), tone: "red" }}
            />
          ))}
        </Section>
      ) : null}

      {escalations.length ? (
        <Section id="escalated" title="Escalated" hint="The client ignored several reminders. Call them, then mark it handled on the request.">
          {escalations.map((e) => (
            <Row
              key={e.id}
              href={`/staff/requests/${e.request.id}`}
              company={e.request.company.name}
              document={e.request.documentType.name}
              officer={showOfficer ? e.notifiedUser.name : undefined}
              badge={{ text: `${e.remindersSent} reminders, no upload`, tone: "orange" }}
            />
          ))}
        </Section>
      ) : null}

      {dueSoon.length ? (
        <Section id="due-soon" title="Due this week">
          {dueSoon.map((r) => {
            const dl = daysLeft(r.dueDate, now);
            return (
              <Row
                key={r.id}
                href={`/staff/requests/${r.id}`}
                company={r.company.name}
                document={r.documentType.name}
                officer={showOfficer ? r.company.assignedStaff?.name : undefined}
                badge={{ text: dl <= 0 ? "Due today" : `Due ${formatDueDate(r.dueDate).replace(/ \d{4}$/, "")}`, tone: dl <= 2 ? "amber" : "slate" }}
              />
            );
          })}
        </Section>
      ) : null}

      <p className="border-t pt-6 text-sm text-muted-foreground">
        {metrics.pending} waiting for clients · {metrics.approvedThisMonth} approved this month · {metrics.remindersThisWeek} reminders sent this week
        {metrics.readRate != null ? ` · ${metrics.readRate}% read` : ""}
        {messagesHref ? (
          <>
            {" · "}
            <Link href={messagesHref} className="font-medium text-primary hover:underline">
              Delivery log
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}

const TONES = {
  amber: { icon: "bg-amber-100 text-amber-800", badge: "bg-amber-100 text-amber-900" },
  red: { icon: "bg-red-100 text-red-700", badge: "bg-red-100 text-red-800" },
  orange: { icon: "bg-orange-100 text-orange-800", badge: "bg-orange-100 text-orange-900" },
  sky: { icon: "bg-sky-100 text-sky-800", badge: "bg-sky-100 text-sky-900" },
  slate: { icon: "bg-slate-100 text-slate-700", badge: "bg-slate-100 text-slate-700" },
} as const;
type Tone = keyof typeof TONES;

function Tile({ label, value, icon: Icon, tone, href }: { label: string; value: number; icon: LucideIcon; tone: Tone; href?: string }) {
  const body = (
    <div className={cn("flex h-full items-center gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors sm:p-5", href && "hover:border-primary/60")}>
      <span className={cn("hidden size-10 shrink-0 items-center justify-center rounded-lg sm:flex", value ? TONES[tone].icon : TONES.slate.icon)}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className={cn("font-display text-3xl font-bold leading-none tabular-nums", !value && "text-muted-foreground")}>{value}</p>
        <p className="mt-1.5 truncate text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function Section({ id, title, hint, more, children }: { id: string; title: string; hint?: string; more?: { href: string; label: string }; children: React.ReactNode[] }) {
  const visible = children.slice(0, VISIBLE);
  const hidden = children.slice(VISIBLE);
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-lg font-semibold">
            {title} <span className="ml-1 text-sm font-normal text-muted-foreground">{children.length}</span>
          </h2>
          {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        {more ? (
          <Link href={more.href} className="text-sm font-medium text-primary hover:underline">
            {more.label}
          </Link>
        ) : null}
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">{visible}</ul>
      {hidden.length ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-medium text-primary hover:underline [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show {hidden.length} more</span>
            <span className="hidden group-open:inline">Show less</span>
          </summary>
          <ul className="mt-3 divide-y overflow-hidden rounded-xl border bg-card">{hidden}</ul>
        </details>
      ) : null}
    </section>
  );
}

function Row({ href, company, document, officer, badge }: { href: string; company: string; document: string; officer?: string; badge: { text: string; tone: Tone } }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-5">
        {/* Phone: name, document, then the badge on its own line. Wider: the badge sits on the right. */}
        <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
          <div className="min-w-0 sm:flex-1">
            <p className="truncate font-medium">{company}</p>
            <p className="truncate text-sm text-muted-foreground">
              {document}
              {officer ? ` · ${officer}` : ""}
            </p>
          </div>
          <span className={cn("mt-2 inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium sm:mt-0 sm:shrink-0", TONES[badge.tone].badge)}>
            {badge.text}
          </span>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
