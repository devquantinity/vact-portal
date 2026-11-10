import { prisma, type Prisma } from "@/lib/db";
import { addDaysToDateString, atMytTime, dateOnlyToDb, mytDayOfWeek, todayMyt } from "@/lib/dates";

export type DashboardScope = { staffId?: string };

function companyScope(scope: DashboardScope): Prisma.DocumentRequestWhereInput {
  return scope.staffId ? { company: { assignedStaffId: scope.staffId } } : {};
}

export type DashboardMetrics = {
  pending: number;
  overdue: number;
  awaitingReview: number;
  approvedThisMonth: number;
  remindersThisWeek: number;
  deliveredRate: number | null;
  readRate: number | null;
  openEscalations: number;
  messagesConsidered: number;
};

export async function dashboardMetrics(scope: DashboardScope, now: Date = new Date()): Promise<DashboardMetrics> {
  const today = todayMyt(now);
  const todayDb = dateOnlyToDb(today);
  const monthStart = atMytTime(`${today.slice(0, 7)}-01`, "00:00");
  const dow = mytDayOfWeek(now); // 0 = Sunday
  const weekStart = atMytTime(addDaysToDateString(today, -((dow + 6) % 7)), "00:00"); // Monday 00:00 KL
  const base = companyScope(scope);
  const messageScope: Prisma.MessageLogWhereInput = scope.staffId ? { company: { assignedStaffId: scope.staffId } } : {};

  const [pending, overdue, awaitingReview, approvedThisMonth, remindersThisWeek, messageGroups, openEscalations] = await Promise.all([
    prisma.documentRequest.count({ where: { ...base, status: "PENDING" } }),
    prisma.documentRequest.count({ where: { ...base, status: "PENDING", dueDate: { lt: todayDb } } }),
    prisma.documentRequest.count({ where: { ...base, status: "UPLOADED" } }),
    prisma.documentRequest.count({ where: { ...base, status: "APPROVED", closedAt: { gte: monthStart } } }),
    prisma.messageLog.count({ where: { ...messageScope, kind: "REMINDER", queuedAt: { gte: weekStart }, status: { not: "QUEUED" } } }),
    prisma.messageLog.groupBy({ by: ["status"], _count: { _all: true }, where: { ...messageScope, status: { in: ["SENT", "DELIVERED", "READ", "FAILED"] } } }),
    prisma.escalation.count({ where: { acknowledgedAt: null, ...(scope.staffId ? { notifiedUserId: scope.staffId } : {}) } }),
  ]);

  const count = (s: string) => messageGroups.find((g) => g.status === s)?._count._all ?? 0;
  const considered = count("SENT") + count("DELIVERED") + count("READ") + count("FAILED");
  const delivered = count("DELIVERED") + count("READ");
  return {
    pending,
    overdue,
    awaitingReview,
    approvedThisMonth,
    remindersThisWeek,
    deliveredRate: considered ? Math.round((delivered / considered) * 100) : null,
    readRate: considered ? Math.round((count("READ") / considered) * 100) : null,
    openEscalations,
    messagesConsidered: considered,
  };
}

const requestListInclude = {
  company: { select: { id: true, name: true, assignedStaff: { select: { name: true } } } },
  documentType: { select: { name: true } },
  jobs: { where: { status: "SENT" as const }, select: { scheduledFor: true } },
} satisfies Prisma.DocumentRequestInclude;

export async function overdueRequests(scope: DashboardScope, limit = 25, now: Date = new Date()) {
  return prisma.documentRequest.findMany({
    where: { ...companyScope(scope), status: "PENDING", dueDate: { lt: dateOnlyToDb(todayMyt(now)) } },
    include: requestListInclude,
    orderBy: { dueDate: "asc" },
    take: limit,
  });
}

export async function dueSoonRequests(scope: DashboardScope, days = 7, limit = 25, now: Date = new Date()) {
  const today = todayMyt(now);
  return prisma.documentRequest.findMany({
    where: { ...companyScope(scope), status: "PENDING", dueDate: { gte: dateOnlyToDb(today), lte: dateOnlyToDb(addDaysToDateString(today, days)) } },
    include: requestListInclude,
    orderBy: { dueDate: "asc" },
    take: limit,
  });
}

export async function awaitingReviewRequests(scope: DashboardScope, limit = 25) {
  return prisma.documentRequest.findMany({
    where: { ...companyScope(scope), status: "UPLOADED" },
    include: {
      ...requestListInclude,
      documents: { where: { reviewStatus: "AWAITING" }, orderBy: { uploadedAt: "desc" }, take: 1, select: { uploadedAt: true, uploadedByRole: true } },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
}

export async function openEscalations(scope: DashboardScope, limit = 25) {
  return prisma.escalation.findMany({
    where: { acknowledgedAt: null, ...(scope.staffId ? { notifiedUserId: scope.staffId } : {}) },
    include: {
      request: { include: { company: { select: { id: true, name: true } }, documentType: { select: { name: true } } } },
      notifiedUser: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
