import { addDaysToDateString, atMytTime, isWeekendMyt, mytDateString, mytTimeString } from "@/lib/dates";

export type SendWindow = { sendWindowStart: string; sendWindowEnd: string; skipWeekends: boolean };

/** True when `now` (any instant) falls inside the Kuala Lumpur send window on a sendable day. */
export function isWithinSendWindow(now: Date, window: SendWindow): boolean {
  if (window.skipWeekends && isWeekendMyt(now)) return false;
  const time = mytTimeString(now);
  return time >= window.sendWindowStart && time < window.sendWindowEnd;
}

/**
 * The next instant at which sending is allowed, at or after `now`:
 * - before today's window on a sendable day → today's window start
 * - inside the window → now
 * - otherwise → the next sendable day's window start (skipping weekends when configured)
 */
export function nextSendWindowStart(now: Date, window: SendWindow): Date {
  if (isWithinSendWindow(now, window)) return now;
  let day = mytDateString(now);
  const todayStart = atMytTime(day, window.sendWindowStart);
  const weekendToday = window.skipWeekends && isWeekendMyt(now);
  if (!weekendToday && now.getTime() < todayStart.getTime()) return todayStart;
  for (let i = 0; i < 8; i++) {
    day = addDaysToDateString(day, 1);
    const start = atMytTime(day, window.sendWindowStart);
    if (!window.skipWeekends || !isWeekendMyt(start)) return start;
  }
  return atMytTime(day, window.sendWindowStart);
}
