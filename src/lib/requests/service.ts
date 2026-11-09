import { randomUUID } from "node:crypto";
import { prisma, type UploaderRole } from "@/lib/db";
import { audit } from "@/lib/audit";
import { dateOnlyToDb } from "@/lib/dates";
import { generateSchedule } from "@/lib/reminders/schedule";
import { storage } from "@/lib/storage";
import { validateAndPrepare } from "@/lib/files/validate";
import { notifyApproved, notifyChangesRequested, notifyNewRequest, notifyUploadReceived } from "@/lib/messaging/request-notify";

/** Cancels every SCHEDULED reminder job for a request. Called whenever the request leaves PENDING. */
export async function cancelScheduledJobs(requestId: string): Promise<number> {
  const res = await prisma.reminderJob.updateMany({
    where: { requestId, status: "SCHEDULED" },
    data: { status: "CANCELLED", lockedAt: null },
  });
  return res.count;
}

export async function createRequest(params: {
  companyId: string;
  documentTypeId: string;
  reminderTypeId: string;
  dueDate: string; // yyyy-MM-dd (Kuala Lumpur calendar date)
  instructions: string | null;
  createdById: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const reminderType = await prisma.reminderType.findUniqueOrThrow({ where: { id: params.reminderTypeId } });
  const jobs = generateSchedule(reminderType, params.dueDate, now);

  const request = await prisma.documentRequest.create({
    data: {
      companyId: params.companyId,
      documentTypeId: params.documentTypeId,
      reminderTypeId: params.reminderTypeId,
      dueDate: dateOnlyToDb(params.dueDate),
      instructions: params.instructions,
      createdById: params.createdById,
      status: "PENDING",
      jobs: {
        create: jobs.map((j) => ({ channel: j.channel, scheduledFor: j.scheduledFor, kind: j.kind, status: "SCHEDULED" })),
      },
    },
  });
  await audit(params.createdById, "request.created", "DocumentRequest", request.id, {
    companyId: params.companyId,
    dueDate: params.dueDate,
    jobs: jobs.length,
  });
  // Job 0: the "new request" notification goes out immediately on the rule's channels.
  await notifyNewRequest(request.id).catch((err) => console.error("notifyNewRequest failed", err));
  return { request, jobsCreated: jobs.length };
}

export type IncomingFile = { name: string; bytes: Buffer };

/**
 * Validates, stores and records one or more files against a request, moves the request to UPLOADED,
 * cancels pending reminders and emails the assigned staff. Works the same for clients and staff.
 */
export async function recordUpload(params: {
  requestId: string;
  files: IncomingFile[];
  uploadedById: string;
  uploadedByName: string;
  uploadedByRole: UploaderRole;
}) {
  const request = await prisma.documentRequest.findUniqueOrThrow({
    where: { id: params.requestId },
    include: { documentType: true, documents: { select: { version: true } } },
  });
  if (request.status === "APPROVED" || request.status === "CANCELLED") {
    throw new Error("This request is closed and no longer accepts uploads.");
  }
  if (params.files.length === 0) throw new Error("Choose at least one file.");
  if (params.files.length > 1 && !request.documentType.allowMultipleFiles) {
    throw new Error(`${request.documentType.name} accepts one file per upload.`);
  }

  const prepared = [];
  for (const file of params.files) {
    prepared.push(await validateAndPrepare(file, request.documentType));
  }

  let version = request.documents.reduce((max, d) => Math.max(max, d.version), 0);
  const created = [];
  for (const file of prepared) {
    version += 1;
    const key = `companies/${request.companyId}/requests/${request.id}/${randomUUID()}.${file.extension}`;
    await storage().put(key, file.bytes, file.mimeType);
    const doc = await prisma.document.create({
      data: {
        requestId: request.id,
        version,
        originalName: file.originalName,
        storageKey: key,
        sizeBytes: file.bytes.length,
        mimeType: file.mimeType,
        uploadedById: params.uploadedById,
        uploadedByRole: params.uploadedByRole,
        reviewStatus: "AWAITING",
      },
    });
    created.push(doc);
  }

  const cancelled = await cancelScheduledJobs(request.id);
  await prisma.documentRequest.update({ where: { id: request.id }, data: { status: "UPLOADED" } });
  await audit(params.uploadedById, "document.uploaded", "DocumentRequest", request.id, {
    files: created.map((d) => ({ id: d.id, name: d.originalName, version: d.version, bytes: d.sizeBytes })),
    by: params.uploadedByRole,
    remindersCancelled: cancelled,
  });
  await notifyUploadReceived(request.id, params.uploadedByName, created.map((d) => d.originalName)).catch((err) =>
    console.error("notifyUploadReceived failed", err),
  );
  return { documents: created, remindersCancelled: cancelled };
}

export async function reviewRequest(params: {
  requestId: string;
  decision: "APPROVED" | "CHANGES_REQUESTED";
  comment: string | null;
  reviewerId: string;
  reviewerName: string;
}) {
  const request = await prisma.documentRequest.findUniqueOrThrow({ where: { id: params.requestId } });
  if (request.status !== "UPLOADED" && request.status !== "CHANGES_REQUESTED") {
    throw new Error("Only uploaded requests can be reviewed.");
  }
  if (params.decision === "CHANGES_REQUESTED" && !params.comment?.trim()) {
    throw new Error("Tell the client what needs to change.");
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.document.updateMany({
      where: { requestId: request.id, reviewStatus: "AWAITING" },
      data: { reviewStatus: params.decision, reviewComment: params.comment, reviewedById: params.reviewerId, reviewedAt: now },
    }),
    prisma.documentRequest.update({
      where: { id: request.id },
      data: { status: params.decision, closedAt: params.decision === "APPROVED" ? now : null },
    }),
  ]);
  await cancelScheduledJobs(request.id);
  await audit(params.reviewerId, params.decision === "APPROVED" ? "review.approved" : "review.changes_requested", "DocumentRequest", request.id, {
    comment: params.comment,
  });
  if (params.decision === "APPROVED") {
    await notifyApproved(request.id, params.reviewerName).catch((err) => console.error("notifyApproved failed", err));
  } else {
    await notifyChangesRequested(request.id, params.comment!.trim(), params.reviewerName).catch((err) =>
      console.error("notifyChangesRequested failed", err),
    );
  }
}

export async function cancelRequest(params: { requestId: string; actorId: string; reason: string | null }) {
  const request = await prisma.documentRequest.findUniqueOrThrow({ where: { id: params.requestId } });
  if (request.status === "APPROVED" || request.status === "CANCELLED") throw new Error("This request is already closed.");
  await prisma.documentRequest.update({ where: { id: request.id }, data: { status: "CANCELLED", closedAt: new Date() } });
  const cancelled = await cancelScheduledJobs(request.id);
  await audit(params.actorId, "request.cancelled", "DocumentRequest", request.id, { reason: params.reason, remindersCancelled: cancelled });
}
