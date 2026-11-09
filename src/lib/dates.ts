import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** Everything the business sees happens in Kuala Lumpur time. Storage stays UTC. */
export const TZ = "Asia/Kuala_Lumpur";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "yyyy-MM-dd" of the given instant in Kuala Lumpur. */
export function mytDateString(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd");
}

export function todayMyt(now: Date = new Date()): string {
  return mytDateString(now);
}

/** Converts a Prisma `@db.Date` value (UTC midnight) to "yyyy-MM-dd". */
export function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Builds the Date Prisma expects for a `@db.Date` column from "yyyy-MM-dd". */
export function dateOnlyToDb(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const base = dateOnlyToDb(dateStr);
  return new Date(base.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole calendar days between two "yyyy-MM-dd" strings (b - a). */
export function diffCalendarDays(a: string, b: string): number {
  return Math.round((dateOnlyToDb(b).getTime() - dateOnlyToDb(a).getTime()) / DAY_MS);
}

/** Positive = days until due, negative = days overdue, 0 = due today. */
export function daysLeft(dueDate: Date, now: Date = new Date()): number {
  return diffCalendarDays(todayMyt(now), dateOnly(dueDate));
}

export function isOverdue(dueDate: Date, now: Date = new Date()): boolean {
  return daysLeft(dueDate, now) < 0;
}

/** The UTC instant for a Kuala Lumpur wall-clock time on a given date. time is "HH:mm". */
export function atMytTime(dateStr: string, time: string): Date {
  return fromZonedTime(`${dateStr}T${time}:00`, TZ);
}

/** 0 = Sunday … 6 = Saturday, in Kuala Lumpur. */
export function mytDayOfWeek(date: Date): number {
  return Number(formatInTimeZone(date, TZ, "i")) % 7; // ISO day: 1 (Mon) … 7 (Sun)
}

export function isWeekendMyt(date: Date): boolean {
  const dow = mytDayOfWeek(date);
  return dow === 0 || dow === 6;
}

/** "HH:mm" wall-clock time in Kuala Lumpur. */
export function mytTimeString(date: Date): string {
  return formatInTimeZone(date, TZ, "HH:mm");
}

/** "25 Nov 2026" */
export function formatDueDate(dueDate: Date): string {
  return formatInTimeZone(dateOnlyToDb(dateOnly(dueDate)), "UTC", "d MMM yyyy");
}

export function formatDateString(dateStr: string): string {
  return formatInTimeZone(dateOnlyToDb(dateStr), "UTC", "d MMM yyyy");
}

/** "25 Nov 2026, 09:00" in Kuala Lumpur. */
export function formatDateTime(date: Date | null | undefined, pattern = "d MMM yyyy, HH:mm"): string {
  if (!date) return "";
  return formatInTimeZone(date, TZ, pattern);
}

/** Human description of days left: "3 days left", "Due today", "3 days overdue". */
export function describeDaysLeft(days: number): string {
  if (days === 0) return "Due today";
  if (days > 0) return days === 1 ? "1 day left" : `${days} days left`;
  const late = Math.abs(days);
  return late === 1 ? "1 day overdue" : `${late} days overdue`;
}

export function compareTimeStrings(a: string, b: string): number {
  return a.localeCompare(b);
}
