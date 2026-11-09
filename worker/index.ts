import "dotenv/config";
import { prisma } from "@/lib/db";
import { tick } from "@/lib/reminders/tick";
import { prismaTickStore } from "@/lib/reminders/store";

const INTERVAL_MS = 60_000;
let running = false;

async function runOnce() {
  if (running) return;
  running = true;
  const started = Date.now();
  try {
    const s = await tick(prismaTickStore);
    const changed = s.processed > 0 || s.simulatedAdvanced > 0;
    const line = `sent ${s.sent}, skipped ${s.skipped}, failed ${s.failed}, held ${s.deferred}${s.simulatedAdvanced ? `, simulated advanced ${s.simulatedAdvanced}` : ""} (${Date.now() - started}ms)`;
    console.log(`[worker] ${new Date().toISOString()} ${changed ? line : "idle, heartbeat written"}`);
  } catch (err) {
    console.error("[worker] tick failed", err);
  } finally {
    running = false;
  }
}

async function main() {
  await prisma.$connect();
  console.log(`[worker] started, ticking every ${INTERVAL_MS / 1000}s (WhatsApp ${process.env.WHATSAPP_MODE ?? "simulate"}, email ${process.env.RESEND_API_KEY ? "live" : "simulate"})`);
  await runOnce();
  const timer = setInterval(runOnce, INTERVAL_MS);
  const stop = async () => {
    clearInterval(timer);
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
