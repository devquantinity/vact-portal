import type { Prisma } from "@/lib/db";
import { atMytTime } from "@/lib/dates";

export type MessageFilters = {
  companyId?: string;
  channel?: "WHATSAPP" | "EMAIL";
  status?: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  kind?: string;
  from?: string; // yyyy-MM-dd (KL)
  to?: string; // yyyy-MM-dd (KL), inclusive
  q?: string;
};

export function parseMessageFilters(sp: Record<string, string | string[] | undefined>): MessageFilters {
  const str = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const channel = str("channel");
  const status = str("status");
  const date = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return {
    companyId: str("companyId"),
    channel: channel === "WHATSAPP" || channel === "EMAIL" ? channel : undefined,
    status: ["QUEUED", "SENT", "DELIVERED", "READ", "FAILED"].includes(status ?? "") ? (status as MessageFilters["status"]) : undefined,
    kind: str("kind"),
    from: date(str("from")),
    to: date(str("to")),
    q: str("q")?.trim() || undefined,
  };
}

export function messageWhere(f: MessageFilters): Prisma.MessageLogWhereInput {
  return {
    ...(f.companyId ? { companyId: f.companyId } : {}),
    ...(f.channel ? { channel: f.channel } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.kind ? { kind: f.kind as Prisma.MessageLogWhereInput["kind"] } : {}),
    ...(f.from || f.to
      ? {
          queuedAt: {
            ...(f.from ? { gte: atMytTime(f.from, "00:00") } : {}),
            ...(f.to ? { lt: new Date(atMytTime(f.to, "00:00").getTime() + 24 * 60 * 60 * 1000) } : {}),
          },
        }
      : {}),
    ...(f.q
      ? {
          OR: [
            { recipient: { contains: f.q, mode: "insensitive" } },
            { renderedBody: { contains: f.q, mode: "insensitive" } },
            { subject: { contains: f.q, mode: "insensitive" } },
            { user: { name: { contains: f.q, mode: "insensitive" } } },
            { company: { name: { contains: f.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export const messageInclude = {
  company: { select: { id: true, name: true } },
  user: { select: { name: true } },
  request: { select: { id: true, documentType: { select: { name: true } } } },
} satisfies Prisma.MessageLogInclude;

export function filtersToQuery(f: MessageFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, String(v));
  return p.toString();
}

