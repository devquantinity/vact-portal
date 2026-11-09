import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { applyProviderStatus } from "@/lib/webhooks/status";
import { validMetaSignature } from "@/lib/webhooks/signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Meta webhook verification handshake (hub.mode / hub.verify_token / hub.challenge). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("hub.mode") === "subscribe" && sp.get("hub.verify_token") === env().WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

type MetaStatus = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed" | "deleted" | string;
  timestamp: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
};
type MetaPayload = { entry?: { changes?: { value?: { statuses?: MetaStatus[] } }[] }[] };

/** Delivery status updates: statuses[].status → MessageLog SENT / DELIVERED / READ / FAILED with timestamps. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validMetaSignature(raw, req.headers.get("x-hub-signature-256"), env().WHATSAPP_APP_SECRET)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  let payload: MetaPayload;
  try {
    payload = JSON.parse(raw) as MetaPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const results: Record<string, number> = {};
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        const map: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED" | undefined> = {
          sent: "SENT",
          delivered: "DELIVERED",
          read: "READ",
          failed: "FAILED",
        };
        const status = map[s.status];
        if (!status) continue;
        const err = s.errors?.[0];
        const outcome = await applyProviderStatus({
          providerMessageId: s.id,
          status,
          at: new Date(Number(s.timestamp) * 1000 || Date.now()),
          errorCode: err?.code != null ? String(err.code) : null,
          errorMessage: err ? [err.title, err.message, err.error_data?.details].filter(Boolean).join(" — ") : null,
        });
        results[outcome] = (results[outcome] ?? 0) + 1;
      }
    }
  }
  return NextResponse.json({ ok: true, ...results });
}
