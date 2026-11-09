import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { todayMyt, dateOnlyToDb } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { NewCompanyDialog } from "@/components/admin/new-company-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage(props: PageProps<"/admin/companies">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = sp.status === "ACTIVE" || sp.status === "INACTIVE" ? sp.status : undefined;
  const today = dateOnlyToDb(todayMyt());

  const [companies, staff] = await Promise.all([
    prisma.company.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { ssmNumber: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { name: "asc" },
      include: {
        assignedStaff: { select: { name: true } },
        _count: { select: { contacts: true } },
        requests: { where: { status: "PENDING" }, select: { dueDate: true } },
      },
    }),
    prisma.user.findMany({ where: { role: { in: ["STAFF", "ADMIN"] }, status: { not: "DISABLED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Companies"
        description="Every client company, who looks after it, and what is still outstanding."
        actions={<NewCompanyDialog staff={staff} />}
      />
      <div className="mb-4">
        <SearchFilterBar
          action="/admin/companies"
          query={q}
          placeholder="Search name or SSM number"
          selects={[
            {
              name: "status",
              value: status,
              allLabel: "All statuses",
              options: [
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ],
            },
          ]}
        />
      </div>
      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={q || status ? "No companies match" : "No companies yet"}
          description={q || status ? "Try a different search or clear the filter." : "Add the first client company to start requesting documents."}
          action={!q && !status ? <NewCompanyDialog staff={staff} /> : undefined}
        />
      ) : (
        <Card className="py-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>SSM number</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead className="text-right">Contacts</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => {
                const overdue = c.requests.filter((r) => r.dueDate < today).length;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/companies/${c.id}`} className="text-foreground hover:text-primary hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{c.ssmNumber}</TableCell>
                    <TableCell>{c.assignedStaff?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{c._count.contacts}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.requests.length}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {overdue > 0 ? <Badge variant="overdue">{overdue}</Badge> : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.status === "ACTIVE" ? "approved" : "pending"}>{c.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
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
