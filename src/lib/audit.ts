import { prisma, type Prisma } from "@/lib/db";

export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.password_set"
  | "user.created"
  | "user.invite_sent"
  | "user.disabled"
  | "user.enabled"
  | "company.created"
  | "company.updated"
  | "request.created"
  | "request.cancelled"
  | "document.uploaded"
  | "review.approved"
  | "review.changes_requested"
  | "document_type.changed"
  | "reminder_type.changed"
  | "settings.changed"
  | "scheduler.manual_tick"
  | "scheduler.tick"
  | "message.test_sent"
  | "escalation.acknowledged";

export async function audit(
  actorId: string | null,
  action: AuditAction,
  entity: string,
  entityId: string,
  meta: Prisma.InputJsonValue = {},
) {
  try {
    await prisma.auditLog.create({ data: { actorId, action, entity, entityId, meta } });
  } catch (err) {
    // Audit must never break the main flow.
    console.error("audit failed", action, err);
  }
}
