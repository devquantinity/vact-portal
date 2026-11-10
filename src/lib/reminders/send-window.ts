import { addDaysToDateString, atMytTime, isWeekendMyt, mytDateString, mytTimeString } from "@/lib/dates";

export type SendWindow = {
  sendWindowStart: string;
  sendWindowEnd: string;
  skipWeekends: boolean;
  /** Kuala Lumpur dates (yyyy-MM-dd) on which nothing is sent. */
  holidays?: ReadonlySet<string>;
};

/** True when nothing should be sent on this Kuala Lumpur day (a weekend when skipped, or a public holiday). */
export function isOffDay(instant: Date, window: SendWindow): boolean {
  if (window.skipWeekends && isWeekendMyt(instant)) return true;
  return window.holidays?.has(mytDateString(instant)) ?? false;
}

/** True when `now` (any instant) falls inside the Kuala Lumpur send window on a sendable day. */
export function isWithinSendWindow(now: Date, window: SendWindow): boolean {
  if (isOffDay(now, window)) return false;
  const time = mytTimeString(now);
  return time >= window.sendWindowStart && time < window.sendWindowEnd;
}

/**
 * The next instant at which sending is allowed, at or after `now`:
 * - before today's window on a sendable day → today's window start
 * - inside the window → now
 * - otherwise → the next sendable day's window start (skipping weekends and public holidays when configured)
 */
export function nextSendWindowStart(now: Date, window: SendWindow): Date {
  if (isWithinSendWindow(now, window)) return now;
  let day = mytDateString(now);
  const todayStart = atMytTime(day, window.sendWindowStart);
  if (!isOffDay(now, window) && now.getTime() < todayStart.getTime()) return todayStart;
  // Long breaks (Hari Raya next to a weekend) can be several days; 31 is a safe upper bound.
  for (let i = 0; i < 31; i++) {
    day = addDaysToDateString(day, 1);
    const start = atMytTime(day, window.sendWindowStart);
    if (!isOffDay(start, window)) return start;
  }
  return atMytTime(day, window.sendWindowStart);
}
