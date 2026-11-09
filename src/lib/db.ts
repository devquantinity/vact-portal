import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["warn", "error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@/generated/prisma/enums";
export { Prisma } from "@/generated/prisma/client";
export type {
  User,
  Company,
  CompanyContact,
  DocumentType,
  ReminderType,
  DocumentRequest,
  Document,
  ReminderJob,
  MessageLog,
  Escalation,
  AuditLog,
  Setting,
} from "@/generated/prisma/client";
