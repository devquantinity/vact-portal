import type { Channel, JobKind, RequestStatus } from "@/generated/prisma/enums";
import { isWithinSendWindow, nextSendWindowStart, type SendWindow } from "./send-window";
import { nextRepeatAt } from "./schedule";

export type TickJob = {
  id: string;
  requestId: string;
  channel: Channel;
  kind: JobKind;
  scheduledFor: Date;
  attempts: number;
  request: {
    status: RequestStatus;
    companyId: string;
    reminderType: { repeatEveryDays: number | null; escalateAfter: number | null };
  };
};

export type SendOutcome = { recipient: string; status: "SENT" | "FAILED"; error?: string };

/**
 * Everything tick() needs from the outside world. Prisma implements it for real; tests use an in-memory
 * version so the scheduling rules can be checked without a database or a provider.
 */
export interface TickStore {
  settings(): Promise<SendWindow>;
  /** SCHEDULED jobs due at or before `now` that nobody else is processing. */
  dueJobs(now: Date): Promise<TickJob[]>;
  /** Atomically takes ownership of a job; false when another tick got there first. */
  claim(jobId: string, now: Date): Promise<boolean>;
  defer(jobId: string, to: Date): Promise<void>;
  skip(jobId: string, reason: string): Promise<void>;
  finish(jobId: string, status: "SENT" | "FAILED", info: { at: Date; error?: string }): Promise<void>;
  /** Renders and sends the job's channel to every contact; one outcome per recipient. */
  send(job: TickJob, now: Date): Promise<SendOutcome[]>;
  createRepeat(job: TickJob, at: Date): Promise<void>;
  /** Number of distinct reminder moments already SENT for the request (both channels of one moment count once). */
  sentOccasions(requestId: string): Promise<number>;
  hasEscalation(requestId: string): Promise<boolean>;
  escalate(job: TickJob, remindersSent: number, now: Date): Promise<void>;
  /** Simulated messages: SENT → DELIVERED on the next tick, DELIVERED → READ on the one after. */
  advanceSimulated(now: Date): Promise<number>;
  heartbeat(now: Date): Promise<void>;
}

export type TickSummary = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  deferred: number;
  simulatedAdvanced: number;
  startedAt: string;
  finishedAt: string;
};

export const STALE_LOCK_MS = 5 * 60 * 1000;

/**
 * One scheduler pass. Idempotent and safe to run concurrently: every job is claimed before it is touched,
 * and a job is only ever SENT once.
 */
export async function tick(store: TickStore, now: Date = new Date()): Promise<TickSummary> {
  const summary: TickSummary = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    deferred: 0,
    simulatedAdvanced: 0,
    startedAt: now.toISOString(),
    finishedAt: now.toISOString(),
  };

  // Simulated deliveries move one step per tick, before new sends so a fresh send stays at SENT this round.
  summary.simulatedAdvanced = await store.advanceSimulated(now);

  const window = await store.settings();
  const jobs = await store.dueJobs(now);

  for (const job of jobs) {
    if (!(await store.claim(job.id, now))) continue;
    summary.processed += 1;

    // 2. The request moved on (uploaded, approved, cancelled): nothing to send.
    if (job.request.status !== "PENDING") {
      await store.skip(job.id, `request is ${job.request.status.toLowerCase()}`);
      summary.skipped += 1;
      continue;
    }

    // 3. Outside the send window: hold the job until the window opens.
    if (!isWithinSendWindow(now, window)) {
      await store.defer(job.id, nextSendWindowStart(now, window));
      summary.deferred += 1;
      continue;
    }

    // 4. Render and send to every contact on this channel.
    let outcomes: SendOutcome[];
    try {
      outcomes = await store.send(job, now);
    } catch (err) {
      outcomes = [{ recipient: "*", status: "FAILED", error: err instanceof Error ? err.message : String(err) }];
    }

    if (outcomes.length === 0) {
      await store.skip(job.id, `no contact with ${job.channel === "WHATSAPP" ? "a WhatsApp number" : "an email address"}`);
      summary.skipped += 1;
      continue;
    }

    const anySent = outcomes.some((o) => o.status === "SENT");
    if (anySent) {
      await store.finish(job.id, "SENT", { at: now });
      summary.sent += 1;
    } else {
      await store.finish(job.id, "FAILED", { at: now, error: outcomes.map((o) => `${o.recipient}: ${o.error ?? "failed"}`).join("; ") });
      summary.failed += 1;
    }

    // 5. Keep chasing after the due date until the client complies.
    const repeatEvery = job.request.reminderType.repeatEveryDays;
    if (job.kind === "REPEAT" && repeatEvery) {
      await store.createRepeat(job, nextRepeatAt(now, repeatEvery));
    }

    // 6. Escalate once the configured number of reminders went out with no upload.
    const threshold = job.request.reminderType.escalateAfter;
    if (anySent && threshold) {
      const occasions = await store.sentOccasions(job.requestId);
      if (occasions >= threshold && !(await store.hasEscalation(job.requestId))) {
        await store.escalate(job, occasions, now);
      }
    }
  }

  await store.heartbeat(now);
  summary.finishedAt = new Date().toISOString();
  return summary;
}
