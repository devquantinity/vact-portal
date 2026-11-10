import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, BellRing, CheckCircle2, ClipboardCheck, Clock, Eye, Send, TriangleAlert } from "lucide-react";
import type { DashboardMetrics } from "@/lib/dashboard/queries";
import { cn } from "@/lib/utils";

function Metric({ label, value, hint, icon: Icon, tone, href }: { label: string; value: string; hint?: string; icon: LucideIcon; tone: string; href?: string }) {
  const body = (
    <div className={cn("flex h-full items-start gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors", href && "hover:border-primary/60")}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-2xl font-bold leading-none tabular-nums">{value}</p>
        <p className="mt-1.5 text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
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

export function MetricCards({ m, links }: { m: DashboardMetrics; links: { overdue?: string; review?: string; escalations?: string; messages?: string } }) {
  const pct = (v: number | null) => (v == null ? "—" : `${v}%`);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Pending requests" value={String(m.pending)} hint="Waiting for the client" icon={Clock} tone="bg-slate-100 text-slate-700" />
      <Metric label="Overdue" value={String(m.overdue)} hint="Past the due date" icon={TriangleAlert} tone="bg-red-100 text-red-700" href={links.overdue} />
      <Metric label="Awaiting review" value={String(m.awaitingReview)} hint="Uploaded, needs a decision" icon={ClipboardCheck} tone="bg-amber-100 text-amber-800" href={links.review} />
      <Metric label="Approved this month" value={String(m.approvedThisMonth)} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-800" />
      <Metric label="Reminders sent this week" value={String(m.remindersThisWeek)} hint="WhatsApp + email, Monday to today" icon={Send} tone="bg-sky-100 text-sky-800" href={links.messages} />
      <Metric label="Delivered rate" value={pct(m.deliveredRate)} hint={m.messagesConsidered ? `of ${m.messagesConsidered} messages` : "No messages yet"} icon={BellRing} tone="bg-sky-100 text-sky-800" href={links.messages} />
      <Metric label="Read rate" value={pct(m.readRate)} hint="Read on WhatsApp or opened email" icon={Eye} tone="bg-emerald-100 text-emerald-800" href={links.messages} />
      <Metric label="Open escalations" value={String(m.openEscalations)} hint="Clients ignoring reminders" icon={AlertTriangle} tone="bg-orange-100 text-orange-800" href={links.escalations} />
    </div>
  );
}
