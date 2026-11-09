import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_SETTINGS } from "../src/lib/settings";
import { DEMO_PASSWORD, DOCUMENT_TYPES, REMINDER_TYPES } from "./seed-data";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const started = Date.now();
  const passwordHash = await hash(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  // --- Settings -------------------------------------------------------------------------------
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  // --- Internal users -------------------------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { email: "admin@vact.demo" },
    update: { name: "Nurul Hasanah", role: "ADMIN", status: "ACTIVE", passwordHash },
    create: { email: "admin@vact.demo", name: "Nurul Hasanah", role: "ADMIN", status: "ACTIVE", passwordHash, phone: "+60122001000" },
  });
  const aisyah = await prisma.user.upsert({
    where: { email: "aisyah@vact.demo" },
    update: { name: "Aisyah Rahman", role: "STAFF", status: "ACTIVE", passwordHash },
    create: { email: "aisyah@vact.demo", name: "Aisyah Rahman", role: "STAFF", status: "ACTIVE", passwordHash, phone: "+60122001001" },
  });
  const daniel = await prisma.user.upsert({
    where: { email: "daniel@vact.demo" },
    update: { name: "Daniel Lim", role: "STAFF", status: "ACTIVE", passwordHash },
    create: { email: "daniel@vact.demo", name: "Daniel Lim", role: "STAFF", status: "ACTIVE", passwordHash, phone: "+60122001002" },
  });

  // --- Document types -------------------------------------------------------------------------
  for (const [index, dt] of DOCUMENT_TYPES.entries()) {
    await prisma.documentType.upsert({
      where: { name: dt.name },
      update: {
        description: dt.description,
        acceptedExtensions: dt.acceptedExtensions,
        maxSizeMb: dt.maxSizeMb ?? 10,
        allowMultipleFiles: dt.allowMultipleFiles ?? false,
        sortOrder: index,
      },
      create: {
        name: dt.name,
        description: dt.description,
        acceptedExtensions: dt.acceptedExtensions,
        maxSizeMb: dt.maxSizeMb ?? 10,
        allowMultipleFiles: dt.allowMultipleFiles ?? false,
        active: true,
        sortOrder: index,
      },
    });
  }

  // --- Reminder types -------------------------------------------------------------------------
  for (const rt of REMINDER_TYPES) {
    const data = {
      description: rt.description,
      channel: rt.channel,
      daysBefore: rt.daysBefore,
      repeatEveryDays: rt.repeatEveryDays,
      escalateAfter: rt.escalateAfter,
      whatsappBody: rt.whatsappBody,
      emailSubject: rt.emailSubject,
      emailBody: rt.emailBody,
      active: true,
    };
    await prisma.reminderType.upsert({ where: { name: rt.name }, update: data, create: { name: rt.name, ...data } });
  }

  console.log(
    `Seeded admin ${admin.email}, staff ${aisyah.email} and ${daniel.email}, ${DOCUMENT_TYPES.length} document types, ${REMINDER_TYPES.length} reminder types in ${Date.now() - started}ms`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
