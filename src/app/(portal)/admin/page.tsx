import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require";
import { awaitingReviewRequests, dashboardMetrics, dueSoonRequests, openEscalations, overdueRequests } from "@/lib/dashboard/queries";
import { PageHeader } from "@/components/shared/page-header";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const me = await requireRole("ADMIN");
  const now = new Date();
  const scope = {};
  const [metrics, review, overdue, dueSoon, escalations] = await Promise.all([
    dashboardMetrics(scope, now),
    awaitingReviewRequests(scope, 50),
    overdueRequests(scope, 50, now),
    dueSoonRequests(scope, 7, 50, now),
    openEscalations(scope, 50),
  ]);
  const hour = Number(now.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kuala_Lumpur" }));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`${greeting}, ${me.name.split(" ")[0]}`} description="All companies." />
      <Dashboard
        metrics={metrics}
        review={review}
        overdue={overdue}
        dueSoon={dueSoon}
        escalations={escalations}
        showOfficer
        reviewHref="/staff/reviews?scope=all"
        messagesHref="/admin/messages"
        now={now}
      />
    </div>
  );
}
