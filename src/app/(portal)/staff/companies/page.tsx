import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/require";
import { dateOnlyToDb, todayMyt } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { LinkTabs } from "@/components/shared/link-tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Companies" };

export default async function StaffCompaniesPage(props: PageProps<"/staff/companies">) {
  const me = await requireRole("ADMIN", "STAFF");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const scope = sp.scope === "all" ? "all" : "mine";
  const today = dateOnlyToDb(todayMyt());

  const companies = await prisma.company.findMany({
    where: {
      status: "ACTIVE",
      ...(scope === "mine" ? { assignedStaffId: me.id } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { ssmNumber: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      assignedStaff: { select: { name: true } },
      requests: { where: { status: { in: ["PENDING", "UPLOADED", "CHANGES_REQUESTED"] } }, select: { status: true, dueDate: true } },
    },
  });
  const mineCount = await prisma.company.count({ where: { status: "ACTIVE", assignedStaffId: me.id } });
  const allCount = await prisma.company.count({ where: { status: "ACTIVE" } });

  return (
    <>
      <PageHeader title="Companies" description="Open the company to see its requests, files and every message sent." />
      <LinkTabs
        current={scope}
        hrefFor={(k) => `/staff/companies?scope=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
        tabs={[
          { key: "mine", label: "My companies", count: mineCount },
          { key: "all", label: "All companies", count: allCount },
        ]}
      />
      <div className="mb-4">
        <SearchFilterBar action="/staff/companies" query={q} placeholder="Search name or SSM number" hidden={{ scope }} />
      </div>
      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={scope === "mine" && !q ? "No companies assigned to you yet" : "No companies match"}
          description={scope === "mine" && !q ? "Ask an administrator to assign companies to you, or switch to All companies." : "Try a different search."}
        />
      ) : (
        <Card className="py-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Awaiting review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => {
                const pending = c.requests.filter((r) => r.status === "PENDING");
                const overdue = pending.filter((r) => r.dueDate < today).length;
                const review = c.requests.filter((r) => r.status === "UPLOADED").length;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/staff/companies/${c.id}`} className="font-medium hover:text-primary hover:underline">
                        {c.name}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">{c.ssmNumber}</p>
                    </TableCell>
                    <TableCell>{c.assignedStaff?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell className="text-right tabular-nums">{pending.length}</TableCell>
                    <TableCell className="text-right">{overdue ? <Badge variant="overdue">{overdue}</Badge> : <span className="text-muted-foreground">0</span>}</TableCell>
                    <TableCell className="text-right">{review ? <Badge variant="uploaded">{review}</Badge> : <span className="text-muted-foreground">0</span>}</TableCell>
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
