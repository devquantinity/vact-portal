import type { Metadata } from "next";
import { Building2, CheckCircle2, FolderOpen, Hourglass, MessageSquareWarning, Phone, TriangleAlert } from "lucide-react";
import { requireRole } from "@/lib/auth/require";
import { clientCompanies, clientRequestsFor } from "@/lib/requests/client-queries";
import { formatPhone } from "@/lib/phone";
import { cn, initials } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { ClientRequestCard } from "@/components/client/request-card";
import { CompanySwitcher } from "@/components/client/company-switcher";
import { ProgressRing } from "@/components/client/progress-ring";

export const metadata: Metadata = { title: "My documents" };

function greeting(now: Date) {
  const hour = Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kuala_Lumpur" }));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function ClientHomePage(props: PageProps<"/client">) {
  const me = await requireRole("CLIENT");
  const sp = await props.searchParams;
  const companies = await clientCompanies(me.id);

  if (companies.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No company linked to your account yet"
        description="V ACT will link your company shortly. If you expected to see it here, call the office and they will sort it out."
      />
    );
  }

  const current = companies.find((c) => c.id === sp.company) ?? companies[0];
  const requests = await clientRequestsFor(current.id);
  const action = requests.filter((r) => r.status === "PENDING").sort((a, b) => a.daysLeft - b.daysLeft);
  const overdue = action.filter((r) => r.overdue);
  const waiting = requests.filter((r) => r.status === "UPLOADED");
  const changes = requests.filter((r) => r.status === "CHANGES_REQUESTED");
  const done = requests.filter((r) => r.status === "APPROVED");
  const total = requests.length;
  const firstName = me.name.split(" ")[0];
  const officer = current.assignedStaff;
  const waPhone = officer?.phone ? officer.phone.replace(/^\+/, "") : null;

  return (
    <div className="space-y-8">
      {/* Header: greeting + company on the left, progress on the right */}
      <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{greeting(new Date())}</p>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Hello, {firstName}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {companies.length > 1 ? (
                <CompanySwitcher companies={companies} current={current.id} />
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-navy px-3 py-1.5 text-sm font-medium text-white">
                  <Building2 className="size-4 text-brand" /> {current.name}
                </span>
              )}
              <span className="font-mono text-xs text-muted-foreground">SSM {current.ssmNumber}</span>
            </div>
            {total > 0 ? (
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {action.length === 0 && changes.length === 0
                  ? "Nothing is waiting on you right now. We will message you when something new is needed."
                  : `${action.length + changes.length} item${action.length + changes.length === 1 ? "" : "s"} need${action.length + changes.length === 1 ? "s" : ""} your attention${overdue.length ? `, ${overdue.length} of them overdue` : ""}. Upload from your phone or laptop; reminders stop the moment a file is received.`}
              </p>
            ) : null}
          </div>

          {total > 0 ? (
            <div className="flex items-center gap-5 rounded-xl border bg-background/60 p-4 sm:gap-6 sm:p-5 lg:min-w-[320px]">
              <ProgressRing approved={done.length} total={total} />
              <div className="min-w-0 flex-1 space-y-2.5">
                <p className="font-display text-lg font-semibold leading-tight tracking-tight">
                  {done.length} of {total} approved
                </p>
                <ul className="space-y-1.5 text-sm">
                  <Stat dot="bg-red-500" label="Overdue" value={overdue.length} muted={overdue.length === 0} />
                  <Stat dot="bg-sky-500" label="Waiting for you" value={action.length - overdue.length + changes.length} muted={action.length - overdue.length + changes.length === 0} />
                  <Stat dot="bg-amber-400" label="With V ACT" value={waiting.length} muted={waiting.length === 0} />
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {total === 0 ? (
        <EmptyState icon={FolderOpen} title="Nothing requested yet" description={`When ${officer?.name ?? "V ACT"} asks for a document it will appear here.`} />
      ) : (
        <>
          <Section icon={TriangleAlert} title="Action needed" count={action.length} tone="text-red-600" empty="Nothing waiting for you. Well done.">
            {action.map((r) => (
              <ClientRequestCard key={r.id} r={r} />
            ))}
          </Section>
          <Section icon={MessageSquareWarning} title="Changes requested" count={changes.length} tone="text-orange-600" hideWhenEmpty>
            {changes.map((r) => (
              <ClientRequestCard key={r.id} r={r} />
            ))}
          </Section>
          <div className={cn("grid gap-8", waiting.length && done.length ? "lg:grid-cols-2" : "")}>
            <Section icon={Hourglass} title="Waiting for V ACT" count={waiting.length} tone="text-amber-600" hideWhenEmpty>
              {waiting.map((r) => (
                <ClientRequestCard key={r.id} r={r} />
              ))}
            </Section>
            <Section icon={CheckCircle2} title="Completed" count={done.length} tone="text-emerald-600" hideWhenEmpty>
              {done.map((r) => (
                <ClientRequestCard key={r.id} r={r} />
              ))}
            </Section>
          </div>
        </>
      )}

      {/* Officer contact */}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-navy font-display text-sm font-semibold text-white">
            {initials(officer?.name ?? "V ACT")}
          </span>
          <div>
            <p className="text-sm font-semibold">{officer?.name ?? "The V ACT team"}</p>
            <p className="text-xs text-muted-foreground">Your V ACT officer for {current.name}</p>
          </div>
        </div>
        {officer?.phone ? (
          <div className="flex flex-wrap gap-2">
            <a href={`tel:${officer.phone}`} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent">
              <Phone className="size-4" /> {formatPhone(officer.phone)}
            </a>
            {waPhone ? (
              <a
                href={`https://wa.me/${waPhone}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ dot, label, value, muted }: { dot: string; label: string; value: number; muted: boolean }) {
  return (
    <li className={cn("flex items-center justify-between gap-3", muted && "text-muted-foreground")}>
      <span className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", muted ? "bg-muted-foreground/30" : dot)} />
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </li>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  tone,
  empty,
  hideWhenEmpty,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  tone: string;
  empty?: string;
  hideWhenEmpty?: boolean;
  children: React.ReactNode;
}) {
  if (count === 0 && hideWhenEmpty) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
        <Icon className={`size-4 ${tone}`} /> {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{count}</span>
      </h2>
      {count === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-2.5">{children}</div>
      )}
    </section>
  );
}
