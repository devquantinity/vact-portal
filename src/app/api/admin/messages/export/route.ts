import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { AuthError, requireApiRole } from "@/lib/auth/require";
import { formatDateTime } from "@/lib/dates";
import { messageInclude, messageWhere, parseMessageFilters } from "@/lib/messages/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Delivery log as CSV, honouring the same filters as the page. */
export async function GET(req: NextRequest) {
  try {
    await requireApiRole("ADMIN");
    const filters = parseMessageFilters(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const rows = await prisma.messageLog.findMany({ where: messageWhere(filters), include: messageInclude, orderBy: { queuedAt: "desc" }, take: 10000 });
    const header = ["Queued (MYT)", "Channel", "Type", "Company", "Recipient name", "Recipient", "Document", "Subject", "Status", "Simulated", "Sent", "Delivered", "Read", "Failed", "Error code", "Error", "Provider id", "Body"];
    const lines = [header.join(",")];
    for (const m of rows) {
      lines.push(
        [
          formatDateTime(m.queuedAt, "yyyy-MM-dd HH:mm:ss"),
          m.channel,
          m.kind,
          m.company?.name ?? "",
          m.user?.name ?? "",
          m.recipient,
          m.request?.documentType.name ?? "",
          m.subject ?? "",
          m.status,
          m.simulated ? "yes" : "no",
          m.sentAt ? formatDateTime(m.sentAt, "yyyy-MM-dd HH:mm:ss") : "",
          m.deliveredAt ? formatDateTime(m.deliveredAt, "yyyy-MM-dd HH:mm:ss") : "",
          m.readAt ? formatDateTime(m.readAt, "yyyy-MM-dd HH:mm:ss") : "",
          m.failedAt ? formatDateTime(m.failedAt, "yyyy-MM-dd HH:mm:ss") : "",
          m.errorCode ?? "",
          m.errorMessage ?? "",
          m.providerMessageId ?? "",
          m.renderedBody,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    const csv = `﻿${lines.join("\r\n")}`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vact-delivery-log-${formatDateTime(new Date(), "yyyyMMdd-HHmm")}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("export failed", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
