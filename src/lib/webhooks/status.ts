import { prisma, type MessageStatus } from "@/lib/db";

const RANK: Record<MessageStatus, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 9 };

/**
 * Applies a provider status update to the MessageLog row with that provider id.
 * Never downgrades (a late "sent" after "delivered" is ignored); always sets the matching timestamp.
 */
export async function applyProviderStatus(params: {
  providerMessageId: string;
  status: Exclude<MessageStatus, "QUEUED">;
  at: Date;
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<"updated" | "ignored" | "unknown"> {
  const log = await prisma.messageLog.findUnique({ where: { providerMessageId: params.providerMessageId } });
  if (!log) return "unknown";
  if (params.status !== "FAILED" && RANK[params.status] <= RANK[log.status] && log.status !== "QUEUED") return "ignored";

  const data: Record<string, unknown> = {};
  if (params.status === "SENT") data.sentAt = log.sentAt ?? params.at;
  if (params.status === "DELIVERED") {
    data.sentAt = log.sentAt ?? params.at;
    data.deliveredAt = params.at;
  }
  if (params.status === "READ") {
    data.sentAt = log.sentAt ?? params.at;
    data.deliveredAt = log.deliveredAt ?? params.at;
    data.readAt = params.at;
  }
  if (params.status === "FAILED") {
    data.failedAt = params.at;
    data.errorCode = params.errorCode ?? log.errorCode;
    data.errorMessage = params.errorMessage ?? log.errorMessage;
  }
  // READ beats a late FAILED only if the message was already read; otherwise FAILED wins.
  const nextStatus: MessageStatus = params.status === "FAILED" && log.status === "READ" ? "READ" : params.status;
  await prisma.messageLog.update({ where: { id: log.id }, data: { ...data, status: nextStatus } });
  return "updated";
}
