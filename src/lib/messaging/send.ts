import { prisma, type MessageKind, type MessageLog } from "@/lib/db";
import { deliverEmail } from "./email";
import { deliverWhatsApp } from "./whatsapp";

type Common = {
  kind: MessageKind;
  userId?: string | null;
  companyId?: string | null;
  requestId?: string | null;
  jobId?: string | null;
};

/**
 * Sends an email and records it in MessageLog (QUEUED → SENT or FAILED).
 * Never throws: a provider failure becomes a FAILED row with the error attached.
 */
export async function sendEmailMessage(
  params: Common & { to: string; subject: string; html: string; text: string },
): Promise<MessageLog> {
  const log = await prisma.messageLog.create({
    data: {
      kind: params.kind,
      channel: "EMAIL",
      recipient: params.to,
      subject: params.subject,
      renderedBody: params.text,
      userId: params.userId ?? null,
      companyId: params.companyId ?? null,
      requestId: params.requestId ?? null,
      jobId: params.jobId ?? null,
      status: "QUEUED",
    },
  });
  const result = await deliverEmail({ to: params.to, subject: params.subject, html: params.html, text: params.text });
  return finalise(log.id, result);
}

/**
 * Sends a WhatsApp template message and records it in MessageLog.
 * The stored body is the full text the client sees (fixed template text with the parameters filled in).
 */
export async function sendWhatsAppMessage(
  params: Common & { to: string; clientName: string; body: string; link: string },
): Promise<MessageLog> {
  const log = await prisma.messageLog.create({
    data: {
      kind: params.kind,
      channel: "WHATSAPP",
      recipient: params.to,
      renderedBody: params.body,
      userId: params.userId ?? null,
      companyId: params.companyId ?? null,
      requestId: params.requestId ?? null,
      jobId: params.jobId ?? null,
      status: "QUEUED",
    },
  });
  const result = await deliverWhatsApp({
    to: params.to,
    clientName: params.clientName,
    body: params.body,
    link: params.link,
  });
  await prisma.messageLog.update({ where: { id: log.id }, data: { renderedBody: result.text } });
  return finalise(log.id, result);
}

async function finalise(
  logId: string,
  result: { ok: true; providerMessageId: string; simulated: boolean } | { ok: false; errorCode: string; errorMessage: string },
): Promise<MessageLog> {
  const now = new Date();
  if (result.ok) {
    return prisma.messageLog.update({
      where: { id: logId },
      data: { status: "SENT", sentAt: now, providerMessageId: result.providerMessageId, simulated: result.simulated },
    });
  }
  return prisma.messageLog.update({
    where: { id: logId },
    data: { status: "FAILED", failedAt: now, errorCode: result.errorCode, errorMessage: result.errorMessage },
  });
}
