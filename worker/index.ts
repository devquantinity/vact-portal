import "dotenv/config";
import { prisma } from "@/lib/db";
import { setSetting } from "@/lib/settings";

const INTERVAL_MS = 60_000;
let running = false;

async function heartbeat() {
  await setSetting("workerLastTick", new Date().toISOString());
}

async function loop() {
  if (running) return;
  running = true;
  try {
    await heartbeat();
    console.log(`[worker] ${new Date().toISOString()} heartbeat`);
  } catch (err) {
    console.error("[worker] tick failed", err);
  } finally {
    running = false;
  }
}

async function main() {
  await prisma.$connect();
  console.log(`[worker] started, ticking every ${INTERVAL_MS / 1000}s`);
  await loop();
  const timer = setInterval(loop, INTERVAL_MS);
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
