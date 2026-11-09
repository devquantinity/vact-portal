import type { Metadata } from "next";
import Link from "next/link";
import { Activity } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

export default async function AuditPage(props: PageProps<"/admin/audit">) {
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true, role: true } } },
    }),
    prisma.auditLog.count(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Audit log" description={`Who did what, and when. ${total.toLocaleString()} entries, newest first.`} />
      {rows.length === 0 ? (
        <EmptyState icon={Activity} title="Nothing logged yet" description="Logins, invites, uploads, review decisions and settings changes are recorded here." />
      ) : (
        <>
          <Card className="py-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(r.createdAt, "d MMM yyyy, HH:mm:ss")}</TableCell>
                    <TableCell className="text-sm">{r.actor ? `${r.actor.name}` : <span className="text-muted-foreground">System</span>}</TableCell>
                    <TableCell className="font-mono text-xs">{r.action}</TableCell>
                    <TableCell className="text-sm">
                      {r.entity} <span className="font-mono text-xs text-muted-foreground">{r.entityId.slice(0, 10)}</span>
                    </TableCell>
                    <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground" title={JSON.stringify(r.meta)}>
                      {JSON.stringify(r.meta)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {pages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" disabled={page <= 1}>
                  <Link href={`/admin/audit?page=${page - 1}`} aria-disabled={page <= 1}>
                    Previous
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/audit?page=${page + 1}`} aria-disabled={page >= pages}>
                    Next
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
