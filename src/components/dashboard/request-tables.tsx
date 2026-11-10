import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { daysLeft, describeDaysLeft, formatDateTime, formatDueDate } from "@/lib/dates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { AcknowledgeEscalationButton } from "./acknowledge-button";

type RequestRow = {
  id: string;
  dueDate: Date;
  company: { id: string; name: string; assignedStaff: { name: string } | null };
  documentType: { name: string };
  jobs: { scheduledFor: Date }[];
};

export function RequestsCard({
  title,
  description,
  rows,
  emptyTitle,
  emptyDescription,
  showOfficer,
  now,
  tone = "overdue",
}: {
  title: string;
  description?: string;
  rows: RequestRow[];
  emptyTitle: string;
  emptyDescription?: string;
  showOfficer: boolean;
  now: Date;
  tone?: "overdue" | "soon";
}) {
  return (
    <Card className="py-0 gap-0 overflow-hidden">
      <CardHeader className="py-4">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState compact icon={CheckCircle2} title={emptyTitle} description={emptyDescription} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Reminders</TableHead>
                {showOfficer ? <TableHead>Officer</TableHead> : null}
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const dl = daysLeft(r.dueDate, now);
                const sentMoments = new Set(r.jobs.map((j) => j.scheduledFor.getTime())).size;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link href={`/staff/companies/${r.company.id}`} className="hover:text-primary hover:underline">
                        {r.company.name}
                      </Link>
                    </TableCell>
                    <TableCell>{r.documentType.name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDueDate(r.dueDate)}
                      <Badge variant={tone === "overdue" ? "overdue" : dl <= 2 ? "uploaded" : "pending"} className="ml-2">
                        {describeDaysLeft(dl)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{sentMoments ? `${sentMoments} sent` : "none yet"}</TableCell>
                    {showOfficer ? <TableCell className="text-sm">{r.company.assignedStaff?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell> : null}
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/staff/requests/${r.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

type ReviewRow = RequestRow & { documents: { uploadedAt: Date; uploadedByRole: "CLIENT" | "STAFF" }[] };

export function ReviewCard({ rows, showOfficer, scopeQuery }: { rows: ReviewRow[]; showOfficer: boolean; scopeQuery: string }) {
  return (
    <Card className="py-0 gap-0 overflow-hidden">
      <CardHeader className="py-4">
        <CardTitle>Awaiting review</CardTitle>
        <CardDescription>Oldest upload first.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState compact icon={CheckCircle2} title="Nothing to review" description="Every upload has a decision." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Uploaded</TableHead>
                {showOfficer ? <TableHead>Officer</TableHead> : null}
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.company.name}</TableCell>
                  <TableCell>{r.documentType.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.documents[0] ? `${formatDateTime(r.documents[0].uploadedAt)}${r.documents[0].uploadedByRole === "STAFF" ? " (staff)" : ""}` : "—"}
                  </TableCell>
                  {showOfficer ? <TableCell className="text-sm">{r.company.assignedStaff?.name ?? "—"}</TableCell> : null}
                  <TableCell>
                    <Button asChild size="sm">
                      <Link href={`/staff/reviews?${scopeQuery}&request=${r.id}`}>Review</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

type EscalationRow = {
  id: string;
  createdAt: Date;
  remindersSent: number;
  notifiedUser: { name: string };
  request: { id: string; dueDate: Date; company: { id: string; name: string }; documentType: { name: string } };
};

export function EscalationsCard({ rows, now, showOfficer }: { rows: EscalationRow[]; now: Date; showOfficer: boolean }) {
  return (
    <Card className="py-0 gap-0 overflow-hidden">
      <CardHeader className="py-4">
        <CardTitle>Open escalations</CardTitle>
        <CardDescription>Clients who ignored the configured number of reminders. Acknowledge once you have called them.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState compact icon={CheckCircle2} title="No open escalations" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Reminders</TableHead>
                {showOfficer ? <TableHead>Notified</TableHead> : null}
                <TableHead>Raised</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    <Link href={`/staff/companies/${e.request.company.id}`} className="hover:text-primary hover:underline">
                      {e.request.company.name}
                    </Link>
                  </TableCell>
                  <TableCell>{e.request.documentType.name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDueDate(e.request.dueDate)} <Badge variant="overdue" className="ml-1">{describeDaysLeft(daysLeft(e.request.dueDate, now))}</Badge>
                  </TableCell>
                  <TableCell>{e.remindersSent} sent</TableCell>
                  {showOfficer ? <TableCell className="text-sm">{e.notifiedUser.name}</TableCell> : null}
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(e.createdAt, "d MMM, HH:mm")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/staff/requests/${e.request.id}`}>Open</Link>
                      </Button>
                      <AcknowledgeEscalationButton id={e.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
