import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/require";
import { tick } from "@/lib/reminders/tick";
import { prismaTickStore } from "@/lib/reminders/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Runs one scheduler pass on demand. Allowed for a signed-in admin (the "Run reminders now" button)
 * or with `Authorization: Bearer <CRON_SECRET>` for an external scheduler.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret = env().CRON_SECRET;
  const viaSecret = !!secret && !!bearer && bearer === secret;
  if (!(user?.role === "ADMIN") && !viaSecret) {
    return NextResponse.json({ error: "Admin session or cron secret required" }, { status: 401 });
  }
  try {
    const summary = await tick(prismaTickStore);
    await audit(user?.id ?? null, "scheduler.manual_tick", "Scheduler", "tick", { ...summary, via: user ? "ui" : "secret" });
    return NextResponse.json(summary);
  } catch (err) {
    console.error("manual tick failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Tick failed" }, { status: 500 });
  }
}
