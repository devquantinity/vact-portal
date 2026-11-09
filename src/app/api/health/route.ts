import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { workerHeartbeat } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  let db: "ok" | "error" = "ok";
  let dbError: string | undefined;
  let worker: { lastTick: string | null; alive: boolean } = { lastTick: null, alive: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    const hb = await workerHeartbeat();
    worker = { lastTick: hb.lastTickDate?.toISOString() ?? null, alive: hb.workerAlive };
  } catch (err) {
    db = "error";
    dbError = err instanceof Error ? err.message : String(err);
  }
  const ok = db === "ok";
  return NextResponse.json(
    {
      status: ok ? (worker.alive ? "ok" : "degraded") : "error",
      db,
      ...(dbError ? { dbError } : {}),
      worker,
      time: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    },
    { status: ok ? 200 : 503 },
  );
}
