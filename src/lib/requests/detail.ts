import { prisma } from "@/lib/db";
import { dateOnly, daysLeft, formatDateTime, formatDueDate, isOverdue } from "@/lib/dates";
import { signedFileUrl } from "@/lib/files/signed-url";
import { formatPhone } from "@/lib/phone";
import { effectiveMaxSizeMb } from "@/lib/files/limits";
import type { MessageView } from "@/components/messages/message-timeline";

export type DocumentView = {
  id: string;
  version: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByRole: "CLIENT" | "STAFF";
  reviewStatus: "AWAITING" | "APPROVED" | "CHANGES_REQUESTED";
  reviewComment: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  previewUrl: string;
  downloadUrl: string;
  previewable: "pdf" | "image" | null;
};

export type JobView = {
  id: string;
  channel: "WHATSAPP" | "EMAIL";
  kind: "BEFORE_DUE" | "REPEAT";
  status: "SCHEDULED" | "SENT" | "SKIPPED" | "FAILED" | "CANCELLED";
  scheduledFor: string;
  sentAt: string | null;
  lastError: string | null;
};

export type RequestDetail = {
  id: string;
  status: "PENDING" | "UPLOADED" | "CHANGES_REQUESTED" | "APPROVED" | "CANCELLED";
  overdue: boolean;
  daysLeft: number;
  dueDate: string; // yyyy-MM-dd
  dueDateLabel: string;
  instructions: string | null;
  createdAt: string;
  createdBy: string;
  closedAt: string | null;
  company: { id: string; name: string; assignedStaff: string | null };
  contacts: { name: string; email: string; phone: string | null }[];
  documentType: { id: string; name: string; description: string | null; acceptedExtensions: string[]; maxSizeMb: number; allowMultipleFiles: boolean };
  reminderType: { id: string; name: string; channel: "WHATSAPP" | "EMAIL" | "BOTH"; repeatEveryDays: number | null; escalateAfter: number | null };
  documents: DocumentView[];
  jobs: JobView[];
  messages: MessageView[];
  escalations: { id: string; createdAt: string; remindersSent: number; notifiedUser: string; acknowledgedAt: string | null }[];
};

export async function loadRequestDetail(requestId: string, viewerId: string, now: Date = new Date()): Promise<RequestDetail | null> {
  const r = await prisma.documentRequest.findUnique({
    where: { id: requestId },
    include: {
      company: { include: { assignedStaff: { select: { name: true } }, contacts: { include: { user: true }, orderBy: { isPrimary: "desc" } } } },
      documentType: true,
      reminderType: true,
      createdBy: { select: { name: true } },
      documents: { orderBy: { version: "desc" }, include: { uploadedBy: { select: { name: true } }, reviewedBy: { select: { name: true } } } },
      jobs: { orderBy: { scheduledFor: "asc" } },
      messages: { orderBy: { queuedAt: "desc" }, include: { user: { select: { name: true } } } },
      escalations: { orderBy: { createdAt: "desc" }, include: { notifiedUser: { select: { name: true } } } },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    status: r.status,
    overdue: r.status === "PENDING" && isOverdue(r.dueDate, now),
    daysLeft: daysLeft(r.dueDate, now),
    dueDate: dateOnly(r.dueDate),
    dueDateLabel: formatDueDate(r.dueDate),
    instructions: r.instructions,
    createdAt: formatDateTime(r.createdAt),
    createdBy: r.createdBy.name,
    closedAt: r.closedAt ? formatDateTime(r.closedAt) : null,
    company: { id: r.company.id, name: r.company.name, assignedStaff: r.company.assignedStaff?.name ?? null },
    contacts: r.company.contacts.map((c) => ({ name: c.user.name, email: c.user.email, phone: c.user.phone ? formatPhone(c.user.phone) : null })),
    documentType: {
      id: r.documentType.id,
      name: r.documentType.name,
      description: r.documentType.description,
      acceptedExtensions: r.documentType.acceptedExtensions,
      maxSizeMb: effectiveMaxSizeMb(r.documentType.maxSizeMb),
      allowMultipleFiles: r.documentType.allowMultipleFiles,
    },
    reminderType: {
      id: r.reminderType.id,
      name: r.reminderType.name,
      channel: r.reminderType.channel,
      repeatEveryDays: r.reminderType.repeatEveryDays,
      escalateAfter: r.reminderType.escalateAfter,
    },
    documents: r.documents.map((d) => ({
      id: d.id,
      version: d.version,
      originalName: d.originalName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      uploadedAt: formatDateTime(d.uploadedAt),
      uploadedBy: d.uploadedBy.name,
      uploadedByRole: d.uploadedByRole,
      reviewStatus: d.reviewStatus,
      reviewComment: d.reviewComment,
      reviewedBy: d.reviewedBy?.name ?? null,
      reviewedAt: d.reviewedAt ? formatDateTime(d.reviewedAt) : null,
      previewUrl: signedFileUrl(d.id, viewerId),
      downloadUrl: signedFileUrl(d.id, viewerId, { download: true }),
      previewable: d.mimeType === "application/pdf" ? "pdf" : d.mimeType.startsWith("image/") ? "image" : null,
    })),
    jobs: r.jobs.map((j) => ({
      id: j.id,
      channel: j.channel,
      kind: j.kind,
      status: j.status,
      scheduledFor: formatDateTime(j.scheduledFor, "EEE d MMM yyyy, HH:mm"),
      sentAt: j.sentAt ? formatDateTime(j.sentAt) : null,
      lastError: j.lastError,
    })),
    messages: r.messages.map((m) => ({
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
    })),
    escalations: r.escalations.map((e) => ({
      id: e.id,
      createdAt: formatDateTime(e.createdAt),
      remindersSent: e.remindersSent,
      notifiedUser: e.notifiedUser.name,
      acknowledgedAt: e.acknowledgedAt ? formatDateTime(e.acknowledgedAt) : null,
    })),
  };
}
