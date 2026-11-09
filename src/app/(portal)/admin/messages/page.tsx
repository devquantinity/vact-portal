import type { Metadata } from "next";
import Link from "next/link";
import { Download, MessagesSquare } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { CHANNEL_LABEL, MESSAGE_KIND_LABEL } from "@/lib/status";
import { filtersToQuery, messageInclude, messageWhere, parseMessageFilters } from "@/lib/messages/query";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { MessageStatusBadge } from "@/components/shared/status-badge";
import { MessageTimeline } from "@/components/messages/message-timeline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/forms/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Delivery log" };

const PAGE_SIZE = 50;

export default async function MessagesPage(props: PageProps<"/admin/messages">) {
  const sp = await props.searchParams;
  const filters = parseMessageFilters(sp);
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const where = messageWhere(filters);
  const [rows, total, companies, counts] = await Promise.all([
    prisma.messageLog.findMany({ where, include: messageInclude, orderBy: { queuedAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.messageLog.count({ where }),
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.messageLog.groupBy({ by: ["status"], _count: { _all: true }, where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const query = filtersToQuery(filters);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader
        title="Delivery log"
        description="Every WhatsApp and email the portal sent, with provider ids and sent / delivered / read timestamps. This is the proof if a client disputes a reminder."
        actions={
          <Button asChild variant="outline">
            <a href={`/api/admin/messages/export${query ? `?${query}` : ""}`}>
              <Download /> Export CSV
            </a>
          </Button>
        }
      />

      <form action="/admin/messages" method="get" className="mb-4 grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-7">
        <Input name="q" defaultValue={filters.q ?? ""} placeholder="Search recipient, text…" className="lg:col-span-2" />
        <NativeSelect name="companyId" defaultValue={filters.companyId ?? ""}>
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="channel" defaultValue={filters.channel ?? ""}>
          <option value="">Both channels</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="EMAIL">Email</option>
        </NativeSelect>
        <NativeSelect name="status" defaultValue={filters.status ?? ""}>
          <option value="">Any status</option>
          <option value="QUEUED">Queued</option>
          <option value="SENT">Sent</option>
          <option value="DELIVERED">Delivered</option>
          <option value="READ">Read</option>
          <option value="FAILED">Failed</option>
        </NativeSelect>
        <Input name="from" type="date" defaultValue={filters.from ?? ""} aria-label="From date" />
        <div className="flex gap-2">
          <Input name="to" type="date" defaultValue={filters.to ?? ""} aria-label="To date" />
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2.5 py-1">{total.toLocaleString()} messages</span>
        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-800">{countOf("SENT")} sent</span>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">{countOf("DELIVERED")} delivered</span>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">{countOf("READ")} read</span>
        <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">{countOf("FAILED")} failed</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="No messages match" description={total === 0 && !query ? "Messages appear here as soon as the first invite or reminder goes out." : "Try widening the filters."} />
      ) : (
        <Card className="py-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Queued</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>About</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last update</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => {
                const last = m.failedAt ?? m.readAt ?? m.deliveredAt ?? m.sentAt ?? m.queuedAt;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(m.queuedAt)}</TableCell>
                    <TableCell>{CHANNEL_LABEL[m.channel]}</TableCell>
                    <TableCell className="text-sm">{MESSAGE_KIND_LABEL[m.kind] ?? m.kind}</TableCell>
                    <TableCell className="text-sm">
                      {m.company ? (
                        <Link href={`/admin/companies/${m.company.id}`} className="hover:text-primary hover:underline">
                          {m.company.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.user?.name ?? "—"}
                      <span className="block text-xs text-muted-foreground">{m.channel === "WHATSAPP" ? formatPhone(m.recipient) : m.recipient}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.request?.documentType.name ?? "—"}</TableCell>
                    <TableCell>
                      <MessageStatusBadge status={m.status} simulated={m.simulated} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(last, "d MMM, HH:mm:ss")}</TableCell>
                    <TableCell>
                      <MessageTimeline
                        message={{
                          id: m.id,
                          channel: m.channel,
                          kind: m.kind,
                          recipient: m.recipient,
                          recipientName: m.user?.name ?? null,
                          subject: m.subject,
                          renderedBody: m.renderedBody,
                          status: m.status,
                          simulated: m.simulated,
                          providerMessageId: m.providerMessageId,
                          errorCode: m.errorCode,
                          errorMessage: m.errorMessage,
                          queuedAt: m.queuedAt.toISOString(),
                          sentAt: m.sentAt?.toISOString() ?? null,
                          deliveredAt: m.deliveredAt?.toISOString() ?? null,
                          readAt: m.readAt?.toISOString() ?? null,
                          failedAt: m.failedAt?.toISOString() ?? null,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/messages?${query}&page=${page - 1}`}>Previous</Link>
              </Button>
            ) : null}
            {page < pages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/messages?${query}&page=${page + 1}`}>Next</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
