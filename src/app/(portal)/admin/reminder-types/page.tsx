import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { CHANNEL_LABEL } from "@/lib/status";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ActiveBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Reminder types" };

export default async function ReminderTypesPage() {
  const types = await prisma.reminderType.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { requests: true } } },
  });
  return (
    <>
      <PageHeader
        title="Reminder types"
        description="Each rule decides the channel, when reminders go out, how often they repeat and when staff are alerted."
        actions={
          <Button asChild>
            <Link href="/admin/reminder-types/new">
              <Plus /> New reminder type
            </Link>
          </Button>
        }
      />
      {types.length === 0 ? (
        <EmptyState icon={Bell} title="No reminder types" description="Create a rule to control when clients are chased." />
      ) : (
        <Card className="py-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Before due</TableHead>
                <TableHead>After due</TableHead>
                <TableHead>Escalate</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/admin/reminder-types/${t.id}`} className="font-medium hover:text-primary hover:underline">
                      {t.name}
                    </Link>
                    {t.description ? <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p> : null}
                  </TableCell>
                  <TableCell>{CHANNEL_LABEL[t.channel]}</TableCell>
                  <TableCell className="text-sm">{t.daysBefore.length ? `${t.daysBefore.join(", ")} days` : "—"}</TableCell>
                  <TableCell className="text-sm">{t.repeatEveryDays ? `Every ${t.repeatEveryDays} days` : "Stops"}</TableCell>
                  <TableCell className="text-sm">{t.escalateAfter ? `After ${t.escalateAfter}` : "Never"}</TableCell>
                  <TableCell className="text-right tabular-nums">{t._count.requests}</TableCell>
                  <TableCell>
                    <ActiveBadge active={t.active} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
