import "./load-env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Seeds the database only when it has no users yet. The Vercel build runs this after `prisma migrate deploy`,
 * so the first deployment comes up with the demo data and later deployments leave live data alone.
 * To start over on a hosted database, reset it (see README) and redeploy.
 */
async function isEmpty(): Promise<boolean> {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const users = await prisma.user.count();
    if (users > 0) console.log(`Seed skipped: the database already has ${users} users.`);
    return users === 0;
  } finally {
    await prisma.$disconnect();
  }
}

isEmpty()
  .then(async (empty) => {
    if (empty) await import("./seed");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
