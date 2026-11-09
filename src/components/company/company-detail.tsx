import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, FileText, Inbox, MessagesSquare } from "lucide-react";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/require";
import { updateCompanyAction } from "@/actions/companies";
import { dateOnly, dateOnlyToDb, formatDateString, formatDateTime, formatDueDate, isOverdue, todayMyt } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { formatBytes } from "@/lib/utils";
import { CHANNEL_LABEL, MESSAGE_KIND_LABEL } from "@/lib/status";
import { PageHeader } from "@/components/shared/page-header";
import { LinkTabs } from "@/components/shared/link-tabs";
import { DetailList } from "@/components/shared/detail-list";
import { EmptyState } from "@/components/shared/empty-state";
import { MessageStatusBadge, RequestStatusBadge, ReviewStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanyForm } from "@/components/admin/company-form";
import { ContactsPanel } from "./contacts-panel";
import { MessageTimeline } from "@/components/messages/message-timeline";
import { RequestPanel } from "@/components/requests/request-panel";
import { loadRequestDetail } from "@/lib/requests/detail";

const TABS = ["overview", "contacts", "requests", "documents", "messages", "escalations"] as const;
export type CompanyTab = (typeof TABS)[number];

export function parseCompanyTab(value: unknown): CompanyTab {
  return TABS.includes(value as CompanyTab) ? (value as CompanyTab) : "overview";
}

export async function CompanyDetail({
  companyId,
  tab,
  viewer,
  basePath,
  requestsBasePath,
  openRequestId,
}: {
  companyId: string;
  tab: CompanyTab;
  viewer: SessionUser;
  basePath: string;
  /** Where "open request" links go (staff request view). */
  requestsBasePath: string;
  /** When set, the request panel opens on top of the page. */
  openRequestId?: string;
}) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      assignedStaff: { select: { id: true, name: true, phone: true, email: true } },
      contacts: {
        include: {
          user: {
            include: { companyContacts: { include: { company: { select: { id: true, name: true } } } } },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      requests: {
        include: {
          documentType: { select: { name: true } },
          reminderType: { select: { name: true } },
          documents: { orderBy: { version: "desc" }, include: { uploadedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } } },
          jobs: { select: { status: true, sentAt: true, scheduledFor: true } },
          escalations: { include: { notifiedUser: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
        },
        orderBy: [{ dueDate: "asc" }],
      },
      messages: {
        include: { user: { select: { name: true } }, request: { include: { documentType: { select: { name: true } } } } },
        orderBy: { queuedAt: "desc" },
        take: 100,
      },
    },
  });
  if (!company) notFound();

  const canManage = viewer.role === "ADMIN" || company.assignedStaffId === viewer.id;
  const [staff, allClients] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["STAFF", "ADMIN"] }, status: { not: "DISABLED" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "CLIENT", status: { not: "DISABLED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);
  const linkedIds = new Set(company.contacts.map((c) => c.userId));
  const availableClients = allClients.filter((c) => !linkedIds.has(c.id));

  const now = new Date();
  const today = dateOnlyToDb(todayMyt(now));
  const openRequests = company.requests.filter((r) => r.status !== "APPROVED" && r.status !== "CANCELLED");
  const overdueCount = company.requests.filter((r) => r.status === "PENDING" && r.dueDate < today).length;
  const documents = company.requests.flatMap((r) => r.documents.map((d) => ({ ...d, request: r })));
  const escalations = company.requests.flatMap((r) => r.escalations.map((e) => ({ ...e, request: r })));
  const openEscalations = escalations.filter((e) => !e.acknowledgedAt).length;

  const fye = company.financialYearEnd
    ? formatDateString(`2000-${company.financialYearEnd}`).replace(" 2000", "")
    : null;

  const hrefFor = (key: string) => `${basePath}?tab=${key}`;
  const openRequest = openRequestId ? await loadRequestDetail(openRequestId, viewer.id, now) : null;

  return (
    <>
      {openRequest && openRequest.company.id === company.id ? (
        <RequestPanel key={openRequest.id} request={openRequest} closeHref={`${basePath}?tab=requests`} />
      ) : null}
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {company.name}
            <Badge variant={company.status === "ACTIVE" ? "approved" : "pending"}>{company.status === "ACTIVE" ? "Active" : "Inactive"}</Badge>
          </span>
        }
        description={
          <>
            SSM {company.ssmNumber} · Looked after by {company.assignedStaff?.name ?? "nobody yet"}
            {overdueCount > 0 ? <span className="text-destructive font-medium"> · {overdueCount} overdue</span> : null}
          </>
        }
        actions={
          <Button asChild>
            <Link href={`/staff/requests/new?company=${company.id}`}>New document request</Link>
          </Button>
        }
      />

      <LinkTabs
        current={tab}
        hrefFor={hrefFor}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "contacts", label: "Contacts", count: company.contacts.length },
          { key: "requests", label: "Requests", count: openRequests.length },
          { key: "documents", label: "Documents", count: documents.length },
          { key: "messages", label: "Messages", count: company.messages.length },
          { key: "escalations", label: "Escalations", count: openEscalations },
        ]}
      />

      {tab === "overview" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Company details</CardTitle>
              <CardDescription>Registration and compliance basics.</CardDescription>
            </CardHeader>
            <CardContent>
              <DetailList
                items={[
                  { label: "SSM number", value: <span className="font-mono text-xs">{company.ssmNumber}</span> },
                  { label: "Incorporated", value: company.incorporationDate ? formatDueDate(company.incorporationDate) : null },
                  { label: "Financial year end", value: fye },
                  { label: "Assigned staff", value: company.assignedStaff ? `${company.assignedStaff.name}${company.assignedStaff.phone ? ` · ${formatPhone(company.assignedStaff.phone)}` : ""}` : null },
                  { label: "Primary contact", value: company.contacts.find((c) => c.isPrimary)?.user.name ?? company.contacts[0]?.user.name ?? null },
                  { label: "Open requests", value: `${openRequests.length} (${overdueCount} overdue)` },
                  { label: "Added", value: formatDateTime(company.createdAt, "d MMM yyyy") },
                  { label: "Notes", value: company.notes },
                ]}
              />
            </CardContent>
          </Card>
          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Edit company</CardTitle>
                <CardDescription>Changes apply immediately to new requests and messages.</CardDescription>
              </CardHeader>
              <CardContent>
                <CompanyForm
                  action={updateCompanyAction.bind(null, company.id)}
                  staff={staff}
                  submitLabel="Save changes"
                  defaults={{
                    name: company.name,
                    ssmNumber: company.ssmNumber,
                    incorporationDate: company.incorporationDate ? dateOnly(company.incorporationDate) : "",
                    fyeMonth: company.financialYearEnd ? String(Number(company.financialYearEnd.slice(0, 2))) : "",
                    fyeDay: company.financialYearEnd ? String(Number(company.financialYearEnd.slice(3, 5))) : "",
                    assignedStaffId: company.assignedStaffId ?? "",
                    status: company.status,
                    notes: company.notes ?? "",
                  }}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "contacts" ? (
        <ContactsPanel
          companyId={company.id}
          canManage={canManage}
          availableClients={availableClients}
          contacts={company.contacts.map((c) => ({
            userId: c.userId,
            name: c.user.name,
            email: c.user.email,
            phone: c.user.phone,
            status: c.user.status,
            isPrimary: c.isPrimary,
            otherCompanies: c.user.companyContacts.filter((cc) => cc.companyId !== company.id).map((cc) => cc.company.name),
          }))}
        />
      ) : null}

      {tab === "requests" ? (
        company.requests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No document requests yet"
            description="Create the first request and the portal takes care of the reminders."
            action={
              <Button asChild>
                <Link href={`/staff/requests/new?company=${company.id}`}>New document request</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {(
              [
                ["Action needed", company.requests.filter((r) => r.status === "PENDING" || r.status === "CHANGES_REQUESTED")],
                ["Awaiting review", company.requests.filter((r) => r.status === "UPLOADED")],
                ["Completed", company.requests.filter((r) => r.status === "APPROVED")],
                ["Cancelled", company.requests.filter((r) => r.status === "CANCELLED")],
              ] as const
            )
              .filter(([, rows]) => rows.length > 0)
              .map(([label, rows]) => (
                <div key={label}>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{label}</h3>
                  <Card className="py-0 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Document</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reminders</TableHead>
                          <TableHead>Reminder rule</TableHead>
                          <TableHead className="w-24" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => {
                          const sent = r.jobs.filter((j) => j.status === "SENT");
                          const scheduled = r.jobs.filter((j) => j.status === "SCHEDULED").sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
                          return (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium">{r.documentType.name}</TableCell>
                              <TableCell className="whitespace-nowrap">{formatDueDate(r.dueDate)}</TableCell>
                              <TableCell>
                                <RequestStatusBadge status={r.status} overdue={isOverdue(r.dueDate, now)} />
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {sent.length} sent
                                {scheduled[0] ? ` · next ${formatDateTime(scheduled[0].scheduledFor, "d MMM HH:mm")}` : ""}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{r.reminderType.name}</TableCell>
                              <TableCell>
                                <Button asChild variant="ghost" size="sm">
                                  <Link href={`${requestsBasePath}?request=${r.id}`}>Open</Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              ))}
          </div>
        )
      ) : null}

      {tab === "documents" ? (
        documents.length === 0 ? (
          <EmptyState icon={FileText} title="No files yet" description="Files uploaded by the client or by staff appear here with their version history." />
        ) : (
          <Card className="py-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents
                  .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
                  .map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <p className="font-medium">{d.originalName}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(d.sizeBytes)}</p>
                      </TableCell>
                      <TableCell>{d.request.documentType.name}</TableCell>
                      <TableCell>v{d.version}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(d.uploadedAt)} by {d.uploadedBy.name} ({d.uploadedByRole === "STAFF" ? "staff" : "client"})
                      </TableCell>
                      <TableCell>
                        <ReviewStatusBadge status={d.reviewStatus} />
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`${requestsBasePath}?request=${d.requestId}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        )
      ) : null}

      {tab === "messages" ? (
        company.messages.length === 0 ? (
          <EmptyState icon={MessagesSquare} title="No messages yet" description="Every WhatsApp and email sent for this company is listed here with its delivery status." />
        ) : (
          <Card className="py-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>About</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.messages.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDateTime(m.queuedAt)}</TableCell>
                    <TableCell>{CHANNEL_LABEL[m.channel]}</TableCell>
                    <TableCell>{MESSAGE_KIND_LABEL[m.kind] ?? m.kind}</TableCell>
                    <TableCell className="text-sm">
                      {m.user?.name ?? "—"}
                      <span className="block text-xs text-muted-foreground">{m.channel === "WHATSAPP" ? formatPhone(m.recipient) : m.recipient}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.request?.documentType.name ?? "—"}</TableCell>
                    <TableCell>
                      <MessageStatusBadge status={m.status} simulated={m.simulated} />
                    </TableCell>
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
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      ) : null}

      {tab === "escalations" ? (
        escalations.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="No escalations" description="When a client ignores the configured number of reminders, the assigned officer is notified and it shows up here." />
        ) : (
          <Card className="py-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Raised</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Reminders sent</TableHead>
                  <TableHead>Notified</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escalations.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDateTime(e.createdAt)}</TableCell>
                    <TableCell>{e.request.documentType.name}</TableCell>
                    <TableCell>{e.remindersSent}</TableCell>
                    <TableCell>{e.notifiedUser.name}</TableCell>
                    <TableCell>
                      {e.acknowledgedAt ? <Badge variant="approved">Acknowledged</Badge> : <Badge variant="overdue">Open</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )
      ) : null}
    </>
  );
}
