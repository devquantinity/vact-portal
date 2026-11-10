import { describe, expect, it } from "vitest";
import { atMytTime } from "@/lib/dates";
import { DEFAULT_PUBLIC_HOLIDAYS, holidayDates, parseHolidays } from "@/lib/reminders/holidays";
import { isWithinSendWindow, nextSendWindowStart } from "@/lib/reminders/send-window";

const HOLIDAYS = holidayDates(DEFAULT_PUBLIC_HOLIDAYS);
const WINDOW = { sendWindowStart: "09:00", sendWindowEnd: "18:00", skipWeekends: true, holidays: HOLIDAYS };
const iso = (d: Date) => d.toISOString();

describe("public holidays", () => {
  it("parses the default list without errors", () => {
    const list = parseHolidays(DEFAULT_PUBLIC_HOLIDAYS);
    expect(list.length).toBeGreaterThan(40);
    expect(list.every((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date) && h.name)).toBe(true);
  });

  it("rejects a line without a date", () => {
    expect(() => parseHolidays("2027-03-10 Hari Raya\nRaya day 2")).toThrow(/Line 2/);
  });

  it("does not send on Christmas Day 2026 (a Friday)", () => {
    expect(isWithinSendWindow(atMytTime("2026-12-25", "10:00"), WINDOW)).toBe(false);
    expect(isWithinSendWindow(atMytTime("2026-12-24", "10:00"), WINDOW)).toBe(true);
  });

  it("moves a Christmas Day reminder past the weekend to Monday 28 Dec", () => {
    expect(iso(nextSendWindowStart(atMytTime("2026-12-25", "09:00"), WINDOW))).toBe(iso(atMytTime("2026-12-28", "09:00")));
  });

  it("skips Hari Raya 2027 (Wed-Thu) to Friday", () => {
    expect(iso(nextSendWindowStart(atMytTime("2027-03-10", "09:00"), WINDOW))).toBe(iso(atMytTime("2027-03-12", "09:00")));
  });

  it("skips a long break: Sat 6 Jun to Tue 8 Jun 2027 lands on Wednesday", () => {
    expect(iso(nextSendWindowStart(atMytTime("2027-06-05", "10:00"), WINDOW))).toBe(iso(atMytTime("2027-06-09", "09:00")));
  });

  it("sends on holidays when the setting is off", () => {
    expect(isWithinSendWindow(atMytTime("2026-12-25", "10:00"), { ...WINDOW, holidays: undefined })).toBe(true);
  });
});
