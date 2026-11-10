import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/require";
import { tick } from "@/lib/reminders/tick";
import { prismaTickStore } from "@/lib/reminders/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function hasCronSecret(req: NextRequest): boolean {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret = env().CRON_SECRET;
  return !!secret && !!bearer && bearer === secret;
}

async function runTick(via: "ui" | "secret" | "cron", actorId: string | null) {
  try {
    const summary = await tick(prismaTickStore);
    await audit(actorId, "scheduler.manual_tick", "Scheduler", "tick", { ...summary, via });
    return NextResponse.json(summary);
  } catch (err) {
    console.error("tick failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Tick failed" }, { status: 500 });
  }
}

/**
 * Runs one scheduler pass on demand. Allowed for a signed-in admin (the "Run reminders now" button)
 * or with `Authorization: Bearer <CRON_SECRET>` for an external scheduler.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  const viaSecret = hasCronSecret(req);
  if (!(user?.role === "ADMIN") && !viaSecret) {
    return NextResponse.json({ error: "Admin session or cron secret required" }, { status: 401 });
  }
  return runTick(user ? "ui" : "secret", user?.id ?? null);
}

/** Vercel Cron (and other pingers) call GET with the bearer secret; the worker is not needed when hosted. */
export async function GET(req: NextRequest) {
  if (!hasCronSecret(req)) return NextResponse.json({ error: "Cron secret required" }, { status: 401 });
  return runTick("cron", null);
}
