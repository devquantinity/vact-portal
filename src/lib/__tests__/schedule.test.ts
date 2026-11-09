import { describe, expect, it } from "vitest";
import { describeSchedule, generateSchedule, nextRepeatAt } from "@/lib/reminders/schedule";

const now = new Date("2026-11-09T04:00:00.000Z"); // 9 Nov 2026, 12:00 KL

describe("generateSchedule", () => {
  it("creates one job per channel per daysBefore value at 09:00 KL", () => {
    const jobs = generateSchedule({ channel: "BOTH", daysBefore: [14, 7, 1], repeatEveryDays: null }, "2026-11-26", now);
    expect(jobs).toHaveLength(6);
    const first = jobs[0];
    expect(first.kind).toBe("BEFORE_DUE");
    expect(first.scheduledFor.toISOString()).toBe("2026-11-12T01:00:00.000Z"); // 12 Nov 09:00 KL
    expect(new Set(jobs.map((j) => j.channel))).toEqual(new Set(["WHATSAPP", "EMAIL"]));
  });

  it("drops reminder dates that are already in the past", () => {
    // due in 5 days: the 14 and 7 day reminders are in the past, only the 1 day one remains
    const jobs = generateSchedule({ channel: "EMAIL", daysBefore: [14, 7, 1], repeatEveryDays: null }, "2026-11-14", now);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].dayOffset).toBe(-1);
  });

  it("adds the first REPEAT job the day after the due date", () => {
    const jobs = generateSchedule({ channel: "WHATSAPP", daysBefore: [1], repeatEveryDays: 3 }, "2026-11-20", now);
    const repeat = jobs.filter((j) => j.kind === "REPEAT");
    expect(repeat).toHaveLength(1);
    expect(repeat[0].scheduledFor.toISOString()).toBe("2026-11-21T01:00:00.000Z");
  });

  it("creates no jobs when the due date is long past and there is no repeat", () => {
    expect(generateSchedule({ channel: "BOTH", daysBefore: [7, 1], repeatEveryDays: null }, "2026-10-01", now)).toEqual([]);
  });

  it("dedupes repeated daysBefore values", () => {
    const jobs = generateSchedule({ channel: "EMAIL", daysBefore: [7, 7, 1], repeatEveryDays: null }, "2026-12-01", now);
    expect(jobs).toHaveLength(2);
  });
});

describe("nextRepeatAt", () => {
  it("schedules the next repeat N days later at 09:00 KL", () => {
    const sentAt = new Date("2026-11-27T02:15:00.000Z"); // 27 Nov 10:15 KL
    expect(nextRepeatAt(sentAt, 3).toISOString()).toBe("2026-11-30T01:00:00.000Z");
  });
});

describe("describeSchedule", () => {
  it("reads like the spec example", () => {
    const text = describeSchedule({ channel: "BOTH", daysBefore: [14, 7, 1], repeatEveryDays: 3, escalateAfter: 3 }, "2026-11-26", now);
    expect(text).toBe(
      "WhatsApp + email on 12 Nov, 19 Nov, 25 Nov, then every 3 days from 27 Nov until uploaded. Staff are alerted after 3 reminders with no upload.",
    );
  });
  it("explains when nothing will be sent", () => {
    expect(describeSchedule({ channel: "EMAIL", daysBefore: [7], repeatEveryDays: null }, "2026-10-01", now)).toMatch(/No reminders will be sent/);
  });
});
