"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/require";
import { emptyToNull, fail, parseForm, succeed, type ActionState } from "@/lib/action-utils";
import { todayMyt } from "@/lib/dates";
import { cancelRequest, createRequest, reviewRequest } from "@/lib/requests/service";
import { audit } from "@/lib/audit";

const createSchema = z.object({
  companyId: z.string().min(1, "Pick a company."),
  documentTypeId: z.string().min(1, "Pick a document type."),
  reminderTypeId: z.string().min(1, "Pick a reminder rule."),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a due date."),
  instructions: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
});

export async function createRequestAction(_prev: ActionState<{ requestId: string }>, formData: FormData): Promise<ActionState<{ requestId: string }>> {
  const actor = await requireRole("ADMIN", "STAFF");
  const parsed = parseForm(createSchema, formData);
  if (!parsed.success) return fail(parsed.error, parsed.fieldErrors);
  const d = parsed.data;
  if (d.dueDate < todayMyt()) return fail("The due date cannot be in the past.", { dueDate: "Pick today or later." });
  const [company, documentType, reminderType] = await Promise.all([
    prisma.company.findUnique({ where: { id: d.companyId }, select: { id: true, status: true } }),
    prisma.documentType.findUnique({ where: { id: d.documentTypeId }, select: { id: true, active: true } }),
    prisma.reminderType.findUnique({ where: { id: d.reminderTypeId }, select: { id: true, active: true } }),
  ]);
  if (!company || company.status !== "ACTIVE") return fail("That company is not active.");
  if (!documentType?.active) return fail("That document type is not active.");
  if (!reminderType?.active) return fail("That reminder rule is not active.");

  const { request } = await createRequest({
    companyId: d.companyId,
    documentTypeId: d.documentTypeId,
    reminderTypeId: d.reminderTypeId,
    dueDate: d.dueDate,
    instructions: d.instructions,
    createdById: actor.id,
  });
  revalidatePath(`/staff/companies/${d.companyId}`);
  revalidatePath(`/admin/companies/${d.companyId}`);
  redirect(`/staff/companies/${d.companyId}?request=${request.id}&created=1`);
}

const reviewSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
  comment: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
});

export async function reviewRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN", "STAFF");
  const parsed = parseForm(reviewSchema, formData);
  if (!parsed.success) return fail(parsed.error, parsed.fieldErrors);
  const d = parsed.data;
  if (d.decision === "CHANGES_REQUESTED" && !d.comment) return fail("Tell the client what needs to change.", { comment: "Required." });
  try {
    await reviewRequest({ requestId: d.requestId, decision: d.decision, comment: d.comment, reviewerId: actor.id, reviewerName: actor.name });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Review failed.");
  }
  revalidatePath("/staff/reviews");
  revalidatePath("/staff");
  revalidatePath("/admin");
  return succeed(d.decision === "APPROVED" ? "Approved. The client has been notified." : "Changes requested. The client has been notified.");
}

export async function cancelRequestAction(requestId: string, reason: string | null): Promise<ActionState> {
  const actor = await requireRole("ADMIN", "STAFF");
  try {
    await cancelRequest({ requestId, actorId: actor.id, reason });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not cancel.");
  }
  revalidatePath("/staff");
  return succeed("Request cancelled and reminders stopped.");
}

export async function acknowledgeEscalationAction(escalationId: string): Promise<ActionState> {
  const actor = await requireRole("ADMIN", "STAFF");
  await prisma.escalation.update({ where: { id: escalationId }, data: { acknowledgedAt: new Date() } });
  await audit(actor.id, "escalation.acknowledged", "Escalation", escalationId, {});
  revalidatePath("/staff");
  revalidatePath("/admin");
  return succeed("Escalation acknowledged.");
}
