import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/require";
import { formatDateTime, formatDueDate } from "@/lib/dates";
import { loadRequestDetail } from "@/lib/requests/detail";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LinkTabs } from "@/components/shared/link-tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequestPanel } from "@/components/requests/request-panel";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewsPage(props: PageProps<"/staff/reviews">) {
  const me = await requireRole("ADMIN", "STAFF");
  const sp = await props.searchParams;
  const scope = sp.scope === "all" ? "all" : "mine";
  const openRequestId = typeof sp.request === "string" ? sp.request : undefined;

  const where = {
    status: "UPLOADED" as const,
    ...(scope === "mine" ? { company: { assignedStaffId: me.id } } : {}),
  };
  const [rows, mineCount, allCount] = await Promise.all([
    prisma.documentRequest.findMany({
      where,
      include: {
        company: { select: { id: true, name: true, assignedStaff: { select: { name: true } } } },
        documentType: { select: { name: true } },
        documents: { where: { reviewStatus: "AWAITING" }, orderBy: { uploadedAt: "desc" }, include: { uploadedBy: { select: { name: true } } } },
      },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.documentRequest.count({ where: { status: "UPLOADED", company: { assignedStaffId: me.id } } }),
    prisma.documentRequest.count({ where: { status: "UPLOADED" } }),
  ]);
  const openRequest = openRequestId ? await loadRequestDetail(openRequestId, me.id) : null;

  return (
    <>
      {openRequest ? <RequestPanel key={openRequest.id} request={openRequest} closeHref={`/staff/reviews?scope=${scope}`} /> : null}
      <PageHeader title="Review queue" description="Uploads waiting for a decision. Approve, or request changes with a comment the client will see." />
      <LinkTabs
        current={scope}
        hrefFor={(k) => `/staff/reviews?scope=${k}`}
        tabs={[
          { key: "mine", label: "My companies", count: mineCount },
          { key: "all", label: "All companies", count: allCount },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing to review" description={scope === "mine" ? "No uploads are waiting on your companies. Switch to All companies to help a colleague." : "Every upload has been reviewed."} />
      ) : (
        <Card className="py-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Officer</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const latest = r.documents[0];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link href={`/staff/companies/${r.company.id}`} className="hover:text-primary hover:underline">
                        {r.company.name}
                      </Link>
                    </TableCell>
                    <TableCell>{r.documentType.name}</TableCell>
                    <TableCell>
                      <Badge variant="uploaded">{r.documents.length} awaiting</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {latest ? `${formatDateTime(latest.uploadedAt)} by ${latest.uploadedBy.name}${latest.uploadedByRole === "STAFF" ? " (staff)" : ""}` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDueDate(r.dueDate)}</TableCell>
                    <TableCell>{r.company.assignedStaff?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell>
                      <Button asChild size="sm">
                        <Link href={`/staff/reviews?scope=${scope}&request=${r.id}`} scroll={false}>
                          Review
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
