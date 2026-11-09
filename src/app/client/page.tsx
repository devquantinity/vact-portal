import type { Metadata } from "next";
import { CheckCircle2, FolderOpen, Hourglass, MessageSquareWarning, TriangleAlert } from "lucide-react";
import { requireRole } from "@/lib/auth/require";
import { clientCompanies, clientRequestsFor } from "@/lib/requests/client-queries";
import { formatPhone } from "@/lib/phone";
import { EmptyState } from "@/components/shared/empty-state";
import { Progress } from "@/components/ui/progress";
import { ClientRequestCard } from "@/components/client/request-card";
import { CompanySwitcher } from "@/components/client/company-switcher";

export const metadata: Metadata = { title: "My documents" };

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
  const waiting = requests.filter((r) => r.status === "UPLOADED");
  const changes = requests.filter((r) => r.status === "CHANGES_REQUESTED");
  const done = requests.filter((r) => r.status === "APPROVED");
  const total = requests.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  const firstName = me.name.split(" ")[0];

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Hello, {firstName}</h1>
            <p className="text-sm text-muted-foreground">
              {companies.length > 1 ? "Documents for" : current.name} {companies.length > 1 ? "" : `· SSM ${current.ssmNumber}`}
            </p>
          </div>
          {companies.length > 1 ? <CompanySwitcher companies={companies} current={current.id} /> : null}
        </div>
        {total > 0 ? (
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">
                {done.length} of {total} documents approved
              </span>
              <span className="text-muted-foreground">{pct}%</span>
            </div>
            <Progress value={pct} indicatorClassName="bg-success" />
            {action.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {action.filter((r) => r.overdue).length > 0 ? `${action.filter((r) => r.overdue).length} overdue · ` : ""}
                {action.length} waiting for you
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {total === 0 ? (
        <EmptyState icon={FolderOpen} title="Nothing requested yet" description={`When ${current.assignedStaff?.name ?? "V ACT"} asks for a document it will appear here.`} />
      ) : (
        <>
          <Section icon={TriangleAlert} title="Action needed" count={action.length} tone="text-destructive" empty="Nothing waiting for you. Well done.">
            {action.map((r) => (
              <ClientRequestCard key={r.id} r={r} />
            ))}
          </Section>
          <Section icon={MessageSquareWarning} title="Changes requested" count={changes.length} tone="text-orange-700" hideWhenEmpty>
            {changes.map((r) => (
              <ClientRequestCard key={r.id} r={r} />
            ))}
          </Section>
          <Section icon={Hourglass} title="Waiting for V ACT" count={waiting.length} tone="text-amber-700" hideWhenEmpty>
            {waiting.map((r) => (
              <ClientRequestCard key={r.id} r={r} />
            ))}
          </Section>
          <Section icon={CheckCircle2} title="Completed" count={done.length} tone="text-emerald-700" hideWhenEmpty>
            {done.map((r) => (
              <ClientRequestCard key={r.id} r={r} />
            ))}
          </Section>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Your V ACT officer: {current.assignedStaff?.name ?? "the V ACT team"}
        {current.assignedStaff?.phone ? ` · ${formatPhone(current.assignedStaff.phone)}` : ""}
      </p>
    </div>
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
    <section className="space-y-2.5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={`size-4 ${tone}`} /> {title}
        <span className="rounded-full bg-muted px-2 text-xs tabular-nums text-foreground">{count}</span>
      </h2>
      {count === 0 ? <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">{empty}</p> : <div className="space-y-2">{children}</div>}
    </section>
  );
}
