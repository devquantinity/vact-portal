import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require";
import { awaitingReviewRequests, dashboardMetrics, openEscalations, overdueRequests, recentMessages } from "@/lib/dashboard/queries";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { EscalationsCard, RequestsCard, ReviewCard } from "@/components/dashboard/request-tables";
import { RecentMessages } from "@/components/dashboard/recent-messages";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const me = await requireRole("ADMIN");
  const now = new Date();
  const scope = {};
  const [metrics, overdue, review, escalations, messages] = await Promise.all([
    dashboardMetrics(scope, now),
    overdueRequests(scope, 25, now),
    awaitingReviewRequests(scope, 8),
    openEscalations(scope, 10),
    recentMessages(scope, 10),
  ]);
  const hour = Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kuala_Lumpur" }));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader title={`${greeting}, ${me.name.split(" ")[0]}`} description="Across all companies. Click a card to drill in." />
      <div className="space-y-6">
        <MetricCards m={metrics} links={{ overdue: "#overdue", review: "/staff/reviews?scope=all", escalations: "#escalations", messages: "/admin/messages" }} />
        <div id="overdue">
          <RequestsCard
            title="Overdue requests"
            description="Pending past the due date. Reminders keep going until the client uploads."
            rows={overdue}
            emptyTitle="Nothing is overdue"
            emptyDescription="Every pending request is still within its due date."
            showOfficer
            now={now}
          />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <ReviewCard rows={review} showOfficer scopeQuery="scope=all" />
          <div id="escalations">
            <EscalationsCard rows={escalations} now={now} showOfficer />
          </div>
        </div>
        <RecentMessages rows={messages} moreHref="/admin/messages" />
      </div>
    </>
  );
}
