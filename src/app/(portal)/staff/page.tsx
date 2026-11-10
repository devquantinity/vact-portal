import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require";
import { awaitingReviewRequests, dashboardMetrics, dueSoonRequests, openEscalations, overdueRequests } from "@/lib/dashboard/queries";
import { PageHeader } from "@/components/shared/page-header";
import { LinkTabs } from "@/components/shared/link-tabs";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = { title: "My work" };

export default async function StaffDashboardPage(props: PageProps<"/staff">) {
  const me = await requireRole("ADMIN", "STAFF");
  const sp = await props.searchParams;
  const all = sp.scope === "all";
  const scope = all ? {} : { staffId: me.id };
  const now = new Date();
  const [metrics, review, overdue, dueSoon, escalations] = await Promise.all([
    dashboardMetrics(scope, now),
    awaitingReviewRequests(scope, 50),
    overdueRequests(scope, 50, now),
    dueSoonRequests(scope, 7, 50, now),
    openEscalations(scope, 50),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="My work" description={all ? "Every company, not just yours." : "The companies assigned to you."} />
      <LinkTabs
        current={all ? "all" : "mine"}
        hrefFor={(k) => `/staff?scope=${k}`}
        tabs={[
          { key: "mine", label: "My companies" },
          { key: "all", label: "All companies" },
        ]}
      />
      <Dashboard
        metrics={metrics}
        review={review}
        overdue={overdue}
        dueSoon={dueSoon}
        escalations={escalations}
        showOfficer={all}
        reviewHref={`/staff/reviews?scope=${all ? "all" : "mine"}`}
        messagesHref={me.role === "ADMIN" ? "/admin/messages" : undefined}
        now={now}
      />
    </div>
  );
}
