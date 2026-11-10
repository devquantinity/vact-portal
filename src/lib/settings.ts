import { prisma, type Prisma } from "@/lib/db";
import { env, FIRM_SHORT, TIMEZONE } from "@/lib/env";
import { DEFAULT_PUBLIC_HOLIDAYS } from "@/lib/reminders/holidays";

export type AppSettings = {
  brandName: string;
  sendWindowStart: string; // "HH:mm" in Asia/Kuala_Lumpur
  sendWindowEnd: string; // "HH:mm"
  skipWeekends: boolean;
  skipPublicHolidays: boolean;
  publicHolidays: string; // one "yyyy-MM-dd Name" per line (Kuala Lumpur)
  timezone: string;
  staffPhone: string; // office line clients call, and {staff_phone} in messages
  officeWhatsapp: string; // number behind the client's WhatsApp button
};

export const DEFAULT_SETTINGS: AppSettings = {
  brandName: `${FIRM_SHORT} Client Portal`,
  sendWindowStart: "09:00",
  sendWindowEnd: "18:00",
  skipWeekends: true,
  skipPublicHolidays: true,
  publicHolidays: DEFAULT_PUBLIC_HOLIDAYS,
  timezone: TIMEZONE,
  // V ACT office line and WhatsApp number, as listed on www.v-act.com.my.
  staffPhone: "+603-2011 8002",
  officeWhatsapp: "+6013-279 5163",
};

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
  const out: AppSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const key = row.key as keyof AppSettings;
    const value = row.value as unknown;
    if (key === "skipWeekends" || key === "skipPublicHolidays") {
      out[key] = Boolean(value);
    } else if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

export async function saveSettings(patch: Partial<AppSettings>) {
  const entries = Object.entries(patch) as [keyof AppSettings, AppSettings[keyof AppSettings]][];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: value as Prisma.InputJsonValue },
        create: { key, value: value as Prisma.InputJsonValue },
      }),
    ),
  );
}

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return (row?.value as T | undefined) ?? null;
}

export async function setSetting(key: string, value: Prisma.InputJsonValue) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** Minutes between scheduler ticks: the worker every minute, Vercel Schedules every 15 (the Hobby minimum). */
export function tickIntervalMinutes(): number {
  return env().TICK_INTERVAL_MINUTES ?? (process.env.VERCEL ? 15 : 1);
}

/**
 * How long without a tick before the scheduler counts as not running: two intervals plus one minute, so a
 * 1-minute worker is stale after 3 minutes and a 15-minute Vercel schedule (which may start up to 15 minutes
 * late on Hobby) after 31.
 */
export function workerStaleMs(intervalMinutes: number = tickIntervalMinutes()): number {
  return (intervalMinutes * 2 + 1) * 60 * 1000;
}

/** When the scheduler last ticked, and whether that is recent enough to call it alive. */
export async function workerHeartbeat(now: Date = new Date()): Promise<{ lastTickDate: Date | null; workerAlive: boolean }> {
  const lastTick = await getSetting<string>("workerLastTick");
  const lastTickDate = lastTick ? new Date(lastTick) : null;
  const workerAlive = lastTickDate ? now.getTime() - lastTickDate.getTime() < workerStaleMs() : false;
  return { lastTickDate, workerAlive };
}
