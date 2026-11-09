import { prisma } from "@/lib/db";
import { getSettings, setSetting } from "@/lib/settings";
import { loadRequestForMessaging, notifyEscalation, sendTemplatedToContacts } from "@/lib/messaging/request-notify";
import { STALE_LOCK_MS, type SendOutcome, type TickStore } from "./tick";

/** The production TickStore, backed by Prisma and the messaging layer. */
export const prismaTickStore: TickStore = {
  async settings() {
    const s = await getSettings();
    return { sendWindowStart: s.sendWindowStart, sendWindowEnd: s.sendWindowEnd, skipWeekends: s.skipWeekends };
  },

  async dueJobs(now) {
    const stale = new Date(now.getTime() - STALE_LOCK_MS);
    const jobs = await prisma.reminderJob.findMany({
      where: { status: "SCHEDULED", scheduledFor: { lte: now }, OR: [{ lockedAt: null }, { lockedAt: { lt: stale } }] },
      orderBy: { scheduledFor: "asc" },
      take: 200,
      include: {
        request: { select: { status: true, companyId: true, reminderType: { select: { repeatEveryDays: true, escalateAfter: true } } } },
      },
    });
    return jobs.map((j) => ({
      id: j.id,
      requestId: j.requestId,
      channel: j.channel,
      kind: j.kind,
      scheduledFor: j.scheduledFor,
      attempts: j.attempts,
      request: j.request,
    }));
  },

  async claim(jobId, now) {
    const stale = new Date(now.getTime() - STALE_LOCK_MS);
    const res = await prisma.reminderJob.updateMany({
      where: { id: jobId, status: "SCHEDULED", OR: [{ lockedAt: null }, { lockedAt: { lt: stale } }] },
      data: { lockedAt: now, attempts: { increment: 1 } },
    });
    return res.count === 1;
  },

  async defer(jobId, to) {
    await prisma.reminderJob.update({ where: { id: jobId }, data: { scheduledFor: to, lockedAt: null, lastError: null } });
  },

  async skip(jobId, reason) {
    await prisma.reminderJob.update({ where: { id: jobId }, data: { status: "SKIPPED", lastError: reason, lockedAt: null } });
  },

  async finish(jobId, status, info) {
    await prisma.reminderJob.update({
      where: { id: jobId },
      data: { status, sentAt: status === "SENT" ? info.at : null, lastError: info.error ?? null, lockedAt: null },
    });
  },

  async send(job, now): Promise<SendOutcome[]> {
    const request = await loadRequestForMessaging(job.requestId);
    const logs = await sendTemplatedToContacts(request, { channels: [job.channel], kind: "REMINDER", jobId: job.id, now });
    return logs.map((l) => ({
      recipient: l.recipient,
      status: l.status === "FAILED" ? "FAILED" : "SENT",
      error: l.errorMessage ?? l.errorCode ?? undefined,
    }));
  },

  async createRepeat(job, at) {
    await prisma.reminderJob.create({
      data: { requestId: job.requestId, channel: job.channel, kind: "REPEAT", scheduledFor: at, status: "SCHEDULED" },
    });
  },

  async sentOccasions(requestId) {
    const rows = await prisma.reminderJob.findMany({ where: { requestId, status: "SENT" }, select: { scheduledFor: true } });
    return new Set(rows.map((r) => r.scheduledFor.getTime())).size;
  },

  async hasEscalation(requestId) {
    return (await prisma.escalation.count({ where: { requestId } })) > 0;
  },

  async escalate(job, remindersSent, now) {
    const request = await loadRequestForMessaging(job.requestId);
    const notified = await notifyEscalation(request, remindersSent, now);
    if (notified.length === 0) return;
    await prisma.escalation.createMany({
      data: notified.map((u) => ({ requestId: job.requestId, notifiedUserId: u.id, remindersSent })),
    });
  },

  async advanceSimulated(now) {
    // READ first (rows delivered on an earlier tick), then DELIVERED (rows sent on an earlier tick),
    // so each simulated message moves exactly one step per tick.
    const read = await prisma.messageLog.updateMany({
      where: { simulated: true, status: "DELIVERED", deliveredAt: { lt: now } },
      data: { status: "READ", readAt: now },
    });
    const delivered = await prisma.messageLog.updateMany({
      where: { simulated: true, status: "SENT", sentAt: { lt: now } },
      data: { status: "DELIVERED", deliveredAt: now },
    });
    return read.count + delivered.count;
  },

  async heartbeat(now) {
    await setSetting("workerLastTick", now.toISOString());
  },
};
