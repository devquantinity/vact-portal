import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require";
import { awaitingReviewRequests, dashboardMetrics, dueSoonRequests, openEscalations, overdueRequests } from "@/lib/dashboard/queries";
import { PageHeader } from "@/components/shared/page-header";
import { LinkTabs } from "@/components/shared/link-tabs";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { EscalationsCard, RequestsCard, ReviewCard } from "@/components/dashboard/request-tables";

export const metadata: Metadata = { title: "My work" };

export default async function StaffDashboardPage(props: PageProps<"/staff">) {
  const me = await requireRole("ADMIN", "STAFF");
  const sp = await props.searchParams;
  const all = sp.scope === "all";
  const scope = all ? {} : { staffId: me.id };
  const now = new Date();
  const [metrics, review, overdue, dueSoon, escalations] = await Promise.all([
    dashboardMetrics(scope, now),
    awaitingReviewRequests(scope, 10),
    overdueRequests(scope, 15, now),
    dueSoonRequests(scope, 7, 15, now),
    openEscalations(scope, 10),
  ]);
  const scopeQuery = all ? "scope=all" : "scope=mine";

  return (
    <>
      <PageHeader title="My work" description={all ? "Every company, not just the ones assigned to you." : "Companies assigned to you. Switch to All companies to cover for a colleague."} />
      <LinkTabs
        current={all ? "all" : "mine"}
        hrefFor={(k) => `/staff?scope=${k}`}
        tabs={[
          { key: "mine", label: "My companies" },
          { key: "all", label: "All companies" },
        ]}
      />
      <div className="space-y-6">
        <MetricCards m={metrics} links={{ overdue: "#overdue", review: `/staff/reviews?${scopeQuery}`, escalations: "#escalations", messages: all ? undefined : undefined }} />
        <ReviewCard rows={review} showOfficer={all} scopeQuery={scopeQuery} />
        <div id="overdue">
          <RequestsCard title="Overdue" description="Pending past the due date." rows={overdue} emptyTitle="Nothing is overdue" showOfficer={all} now={now} />
        </div>
        <RequestsCard title="Due in the next 7 days" rows={dueSoon} emptyTitle="Nothing due this week" emptyDescription="New requests show here once they are within seven days of their due date." showOfficer={all} now={now} tone="soon" />
        <div id="escalations">
          <EscalationsCard rows={escalations} now={now} showOfficer={all} />
        </div>
      </div>
    </>
  );
}
