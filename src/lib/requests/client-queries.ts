import { prisma } from "@/lib/db";
import { daysLeft } from "@/lib/dates";

export type ClientRequestRow = {
  id: string;
  documentType: string;
  description: string | null;
  dueDate: Date;
  daysLeft: number;
  status: "PENDING" | "UPLOADED" | "CHANGES_REQUESTED" | "APPROVED" | "CANCELLED";
  overdue: boolean;
  latestComment: string | null;
  filesCount: number;
  updatedAt: Date;
};

export async function clientCompanies(userId: string) {
  const links = await prisma.companyContact.findMany({
    where: { userId, company: { status: "ACTIVE" } },
    include: { company: { select: { id: true, name: true, ssmNumber: true, assignedStaff: { select: { name: true, phone: true } } } } },
    orderBy: [{ isPrimary: "desc" }, { company: { name: "asc" } }],
  });
  return links.map((l) => l.company);
}

export async function clientRequestsFor(companyId: string, now: Date = new Date()): Promise<ClientRequestRow[]> {
  const rows = await prisma.documentRequest.findMany({
    where: { companyId, status: { not: "CANCELLED" } },
    include: {
      documentType: { select: { name: true, description: true } },
      documents: { orderBy: { version: "desc" }, select: { reviewComment: true, reviewStatus: true } },
    },
    orderBy: [{ dueDate: "asc" }],
  });
  return rows.map((r) => {
    const dl = daysLeft(r.dueDate, now);
    const latestChange = r.documents.find((d) => d.reviewStatus === "CHANGES_REQUESTED" && d.reviewComment);
    return {
      id: r.id,
      documentType: r.documentType.name,
      description: r.documentType.description,
      dueDate: r.dueDate,
      daysLeft: dl,
      status: r.status,
      overdue: r.status === "PENDING" && dl < 0,
      latestComment: r.status === "CHANGES_REQUESTED" ? (latestChange?.reviewComment ?? null) : null,
      filesCount: r.documents.length,
      updatedAt: r.updatedAt,
    };
  });
}
