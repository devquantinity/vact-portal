import { describe, expect, it } from "vitest";
import { tick, type SendOutcome, type TickJob, type TickStore } from "@/lib/reminders/tick";
import { isWithinSendWindow, nextSendWindowStart } from "@/lib/reminders/send-window";
import { atMytTime } from "@/lib/dates";

const WINDOW = { sendWindowStart: "09:00", sendWindowEnd: "18:00", skipWeekends: true };

type Rec = TickJob & { status: string; lastError?: string; sentAt?: Date; locked?: boolean };

/** Small in-memory TickStore so the scheduler rules can be exercised without Postgres or a provider. */
function makeStore(opts: {
  jobs: Rec[];
  window?: typeof WINDOW;
  outcomes?: (job: TickJob) => SendOutcome[];
  escalations?: Set<string>;
}) {
  const jobs = opts.jobs;
  const escalations = opts.escalations ?? new Set<string>();
  const escalated: { requestId: string; remindersSent: number }[] = [];
  const sends: string[] = [];
  let heartbeat: Date | null = null;
  const store: TickStore = {
    settings: async () => opts.window ?? WINDOW,
    dueJobs: async (now) => jobs.filter((j) => j.status === "SCHEDULED" && j.scheduledFor <= now && !j.locked),
    claim: async (id) => {
      const j = jobs.find((x) => x.id === id)!;
      if (j.status !== "SCHEDULED" || j.locked) return false;
      j.locked = true;
      j.attempts += 1;
      return true;
    },
    defer: async (id, to) => {
      const j = jobs.find((x) => x.id === id)!;
      j.scheduledFor = to;
      j.locked = false;
    },
    skip: async (id, reason) => {
      const j = jobs.find((x) => x.id === id)!;
      j.status = "SKIPPED";
      j.lastError = reason;
      j.locked = false;
    },
    finish: async (id, status, info) => {
      const j = jobs.find((x) => x.id === id)!;
      j.status = status;
      j.sentAt = status === "SENT" ? info.at : undefined;
      j.lastError = info.error;
      j.locked = false;
    },
    send: async (job) => {
      sends.push(job.id);
      return opts.outcomes ? opts.outcomes(job) : [{ recipient: "+60123456789", status: "SENT" }];
    },
    createRepeat: async (job, at) => {
      jobs.push({ ...job, id: `${job.id}-next`, scheduledFor: at, kind: "REPEAT", status: "SCHEDULED", attempts: 0, locked: false });
    },
    sentOccasions: async (requestId) => new Set(jobs.filter((j) => j.requestId === requestId && j.status === "SENT").map((j) => j.scheduledFor.getTime())).size,
    hasEscalation: async (requestId) => escalations.has(requestId),
    escalate: async (job, remindersSent) => {
      escalations.add(job.requestId);
      escalated.push({ requestId: job.requestId, remindersSent });
    },
    advanceSimulated: async () => 0,
    heartbeat: async (now) => {
      heartbeat = now;
    },
  };
  return { store, jobs, sends, escalated, get heartbeat() { return heartbeat; } };
}

function job(partial: Partial<Rec> & { id: string }): Rec {
  return {
    requestId: "req-1",
    channel: "WHATSAPP",
    kind: "BEFORE_DUE",
    scheduledFor: atMytTime("2026-11-18", "09:00"),
    attempts: 0,
    status: "SCHEDULED",
    request: { status: "PENDING", companyId: "co-1", reminderType: { repeatEveryDays: 3, escalateAfter: 3 } },
    ...partial,
  };
}

describe("send window", () => {
  it("knows when sending is allowed", () => {
    expect(isWithinSendWindow(atMytTime("2026-11-18", "09:00"), WINDOW)).toBe(true); // Wed 09:00
    expect(isWithinSendWindow(atMytTime("2026-11-18", "18:00"), WINDOW)).toBe(false);
    expect(isWithinSendWindow(atMytTime("2026-11-14", "10:00"), WINDOW)).toBe(false); // Sat
  });
  it("rolls a Friday-evening job over the weekend to Monday morning", () => {
    const fridayNight = atMytTime("2026-11-13", "19:30");
    expect(nextSendWindowStart(fridayNight, WINDOW).toISOString()).toBe(atMytTime("2026-11-16", "09:00").toISOString());
  });
  it("rolls a Saturday job to Monday, or keeps Saturday when weekends are allowed", () => {
    const sat = atMytTime("2026-11-14", "09:00");
    expect(nextSendWindowStart(sat, WINDOW).toISOString()).toBe(atMytTime("2026-11-16", "09:00").toISOString());
    expect(nextSendWindowStart(sat, { ...WINDOW, skipWeekends: false }).toISOString()).toBe(sat.toISOString());
  });
  it("holds an early-morning job until the window opens the same day", () => {
    const early = atMytTime("2026-11-18", "07:15");
    expect(nextSendWindowStart(early, WINDOW).toISOString()).toBe(atMytTime("2026-11-18", "09:00").toISOString());
  });
});

describe("tick", () => {
  it("sends due jobs inside the window and leaves future jobs alone", async () => {
    const s = makeStore({ jobs: [job({ id: "a" }), job({ id: "b", scheduledFor: atMytTime("2026-11-25", "09:00") })] });
    const summary = await tick(s.store, atMytTime("2026-11-18", "09:05"));
    expect(summary.sent).toBe(1);
    expect(s.jobs.find((j) => j.id === "a")?.status).toBe("SENT");
    expect(s.jobs.find((j) => j.id === "b")?.status).toBe("SCHEDULED");
    expect(s.heartbeat).not.toBeNull();
  });

  it("is idempotent: running twice never sends the same job twice", async () => {
    const s = makeStore({ jobs: [job({ id: "a" })] });
    const now = atMytTime("2026-11-18", "09:05");
    await tick(s.store, now);
    const second = await tick(s.store, now);
    expect(second.sent).toBe(0);
    expect(s.sends).toEqual(["a"]);
  });

  it("skips jobs whose request is no longer pending (cancelled on upload)", async () => {
    const s = makeStore({
      jobs: [job({ id: "a", request: { status: "UPLOADED", companyId: "co-1", reminderType: { repeatEveryDays: 3, escalateAfter: 3 } } })],
    });
    const summary = await tick(s.store, atMytTime("2026-11-18", "09:05"));
    expect(summary.skipped).toBe(1);
    expect(s.sends).toEqual([]);
    expect(s.jobs[0].lastError).toMatch(/uploaded/);
  });

  it("defers a job that comes due outside the window across the weekend", async () => {
    const s = makeStore({ jobs: [job({ id: "a", scheduledFor: atMytTime("2026-11-14", "09:00") })] }); // Saturday
    const summary = await tick(s.store, atMytTime("2026-11-14", "09:00"));
    expect(summary.deferred).toBe(1);
    expect(s.jobs[0].status).toBe("SCHEDULED");
    expect(s.jobs[0].scheduledFor.toISOString()).toBe(atMytTime("2026-11-16", "09:00").toISOString());
    expect(s.sends).toEqual([]);
  });

  it("creates the next REPEAT job after a repeat is sent", async () => {
    const s = makeStore({ jobs: [job({ id: "r", kind: "REPEAT", scheduledFor: atMytTime("2026-11-23", "09:00") })] }); // Monday
    await tick(s.store, atMytTime("2026-11-23", "09:30"));
    const next = s.jobs.find((j) => j.id === "r-next");
    expect(next).toBeDefined();
    expect(next?.kind).toBe("REPEAT");
    expect(next?.scheduledFor.toISOString()).toBe(atMytTime("2026-11-26", "09:00").toISOString());
  });

  it("does not chain BEFORE_DUE jobs", async () => {
    const s = makeStore({ jobs: [job({ id: "a" })] });
    await tick(s.store, atMytTime("2026-11-18", "09:30"));
    expect(s.jobs).toHaveLength(1);
  });

  it("escalates exactly once when the sent-reminder count reaches the threshold", async () => {
    const d = (day: string) => atMytTime(day, "09:00");
    const s = makeStore({
      jobs: [
        // two earlier moments already sent on both channels (count as 2 occasions, not 4 jobs)
        job({ id: "w1", status: "SENT", scheduledFor: d("2026-11-10") }),
        job({ id: "e1", status: "SENT", channel: "EMAIL", scheduledFor: d("2026-11-10") }),
        job({ id: "w2", status: "SENT", scheduledFor: d("2026-11-14") }),
        job({ id: "e2", status: "SENT", channel: "EMAIL", scheduledFor: d("2026-11-14") }),
        // third moment due now, both channels
        job({ id: "w3", scheduledFor: d("2026-11-18") }),
        job({ id: "e3", channel: "EMAIL", scheduledFor: d("2026-11-18") }),
      ],
    });
    const summary = await tick(s.store, atMytTime("2026-11-18", "09:01"));
    expect(summary.sent).toBe(2);
    expect(s.escalated).toEqual([{ requestId: "req-1", remindersSent: 3 }]);
  });

  it("does not escalate below the threshold", async () => {
    const s = makeStore({ jobs: [job({ id: "w1" })] });
    await tick(s.store, atMytTime("2026-11-18", "09:01"));
    expect(s.escalated).toEqual([]);
  });

  it("marks a job FAILED when every recipient fails, and SKIPPED when there is nobody to send to", async () => {
    const failing = makeStore({ jobs: [job({ id: "a" })], outcomes: () => [{ recipient: "+6000", status: "FAILED", error: "invalid number" }] });
    const r1 = await tick(failing.store, atMytTime("2026-11-18", "09:01"));
    expect(r1.failed).toBe(1);
    expect(failing.jobs[0].lastError).toMatch(/invalid number/);
    const nobody = makeStore({ jobs: [job({ id: "b" })], outcomes: () => [] });
    const r2 = await tick(nobody.store, atMytTime("2026-11-18", "09:01"));
    expect(r2.skipped).toBe(1);
    expect(nobody.jobs[0].lastError).toMatch(/no contact/);
  });
});
