import type { Channel, JobKind, ReminderChannel } from "@/generated/prisma/enums";
import { addDaysToDateString, atMytTime, formatDateString, mytDateString } from "@/lib/dates";

export const SEND_TIME = "09:00";

export type ReminderRule = {
  channel: ReminderChannel;
  daysBefore: number[];
  repeatEveryDays: number | null;
  escalateAfter?: number | null;
};

export type PlannedJob = { channel: Channel; scheduledFor: Date; kind: JobKind; dayOffset: number };

export function channelsFor(channel: ReminderChannel): Channel[] {
  return channel === "BOTH" ? ["WHATSAPP", "EMAIL"] : [channel];
}

/**
 * Builds the reminder jobs for a request (pure, no database):
 * - one BEFORE_DUE job per channel for every daysBefore value at 09:00 KL on dueDate - d
 * - the first REPEAT job per channel at dueDate + 1 day 09:00 KL when repeatEveryDays is set
 * - anything already in the past (relative to `now`) is dropped
 */
export function generateSchedule(rule: ReminderRule, dueDate: string, now: Date = new Date()): PlannedJob[] {
  const channels = channelsFor(rule.channel);
  const jobs: PlannedJob[] = [];
  const days = [...new Set(rule.daysBefore)].sort((a, b) => b - a);
  for (const d of days) {
    const at = atMytTime(addDaysToDateString(dueDate, -d), SEND_TIME);
    if (at.getTime() <= now.getTime()) continue;
    for (const channel of channels) jobs.push({ channel, scheduledFor: at, kind: "BEFORE_DUE", dayOffset: -d });
  }
  if (rule.repeatEveryDays) {
    const at = atMytTime(addDaysToDateString(dueDate, 1), SEND_TIME);
    if (at.getTime() > now.getTime()) {
      for (const channel of channels) jobs.push({ channel, scheduledFor: at, kind: "REPEAT", dayOffset: 1 });
    }
  }
  return jobs.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
}

/** Where the next REPEAT job goes after one was sent: repeatEveryDays later, at 09:00 KL. */
export function nextRepeatAt(sentAt: Date, repeatEveryDays: number): Date {
  return atMytTime(addDaysToDateString(mytDateString(sentAt), repeatEveryDays), SEND_TIME);
}

/**
 * "WhatsApp + email on 12 Nov, 19 Nov, 25 Nov, then every 3 days from 27 Nov until uploaded"
 */
export function describeSchedule(rule: ReminderRule, dueDate: string, now: Date = new Date()): string {
  const jobs = generateSchedule(rule, dueDate, now);
  const channelLabel = rule.channel === "BOTH" ? "WhatsApp + email" : rule.channel === "WHATSAPP" ? "WhatsApp" : "Email";
  const beforeDates = [...new Set(jobs.filter((j) => j.kind === "BEFORE_DUE").map((j) => mytDateString(j.scheduledFor)))];
  const repeat = jobs.find((j) => j.kind === "REPEAT");
  const parts: string[] = [];
  if (beforeDates.length) {
    parts.push(`${channelLabel} on ${beforeDates.map((d) => formatDateString(d).replace(/ \d{4}$/, "")).join(", ")}`);
  }
  if (repeat && rule.repeatEveryDays) {
    const from = formatDateString(mytDateString(repeat.scheduledFor)).replace(/ \d{4}$/, "");
    parts.push(
      `${beforeDates.length ? "then " : `${channelLabel} `}every ${rule.repeatEveryDays} day${rule.repeatEveryDays === 1 ? "" : "s"} from ${from} until uploaded`,
    );
  }
  if (parts.length === 0) {
    return rule.repeatEveryDays
      ? "No reminders: every scheduled date is already in the past."
      : "No reminders will be sent: every scheduled date is already in the past and the rule does not repeat after the due date.";
  }
  const sentence = parts.join(", ");
  const escalation = rule.escalateAfter ? ` Staff are alerted after ${rule.escalateAfter} reminder${rule.escalateAfter === 1 ? "" : "s"} with no upload.` : "";
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.${escalation}`;
}
