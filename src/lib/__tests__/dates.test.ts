import { describe, expect, it } from "vitest";
import {
  addDaysToDateString,
  atMytTime,
  dateOnlyToDb,
  daysLeft,
  describeDaysLeft,
  formatDueDate,
  isWeekendMyt,
  mytDateString,
  mytTimeString,
} from "@/lib/dates";

describe("Kuala Lumpur date helpers", () => {
  it("converts a KL wall-clock time to the right UTC instant", () => {
    // 09:00 MYT == 01:00 UTC
    expect(atMytTime("2026-11-25", "09:00").toISOString()).toBe("2026-11-25T01:00:00.000Z");
    expect(mytTimeString(atMytTime("2026-11-25", "18:00"))).toBe("18:00");
  });
  it("knows the KL calendar date of an instant", () => {
    // 23:30 UTC on 24 Nov is already 25 Nov in KL
    expect(mytDateString(new Date("2026-11-24T23:30:00.000Z"))).toBe("2026-11-25");
  });
  it("computes days left against the KL date", () => {
    const due = dateOnlyToDb("2026-11-25");
    expect(daysLeft(due, new Date("2026-11-22T10:00:00.000Z"))).toBe(3);
    expect(daysLeft(due, new Date("2026-11-25T10:00:00.000Z"))).toBe(0);
    expect(daysLeft(due, new Date("2026-11-28T10:00:00.000Z"))).toBe(-3);
    expect(describeDaysLeft(-3)).toBe("3 days overdue");
    expect(describeDaysLeft(1)).toBe("1 day left");
    expect(describeDaysLeft(0)).toBe("Due today");
  });
  it("formats and shifts calendar dates", () => {
    expect(formatDueDate(dateOnlyToDb("2026-11-25"))).toBe("25 Nov 2026");
    expect(addDaysToDateString("2026-11-30", 3)).toBe("2026-12-03");
    expect(addDaysToDateString("2026-11-01", -7)).toBe("2026-10-25");
  });
  it("detects KL weekends", () => {
    expect(isWeekendMyt(atMytTime("2026-11-14", "10:00"))).toBe(true); // Saturday
    expect(isWeekendMyt(atMytTime("2026-11-16", "10:00"))).toBe(false); // Monday
  });
});
