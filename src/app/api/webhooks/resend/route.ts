import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { env } from "@/lib/env";
import { applyProviderStatus } from "@/lib/webhooks/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResendEvent = {
  type: string;
  created_at: string;
  data: { email_id: string; bounce?: { message?: string; type?: string }; [key: string]: unknown };
};

const MAP: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED" | undefined> = {
  "email.sent": "SENT",
  "email.delivered": "DELIVERED",
  "email.opened": "READ",
  "email.bounced": "FAILED",
  "email.complained": "FAILED",
  "email.failed": "FAILED",
};

/** Resend → Svix-signed events. email.opened is treated as READ; bounces and complaints as FAILED. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = env().RESEND_WEBHOOK_SECRET;
  let event: ResendEvent;
  try {
    if (secret) {
      const wh = new Webhook(secret);
      event = wh.verify(raw, {
        "svix-id": req.headers.get("svix-id") ?? "",
        "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
        "svix-signature": req.headers.get("svix-signature") ?? "",
      }) as unknown as ResendEvent;
    } else {
      event = JSON.parse(raw) as ResendEvent; // no secret configured (local dev): accept unsigned
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Bad signature" }, { status: 401 });
  }
  const status = MAP[event.type];
  if (!status || !event.data?.email_id) return NextResponse.json({ ok: true, ignored: event.type });
  const outcome = await applyProviderStatus({
    providerMessageId: event.data.email_id,
    status,
    at: new Date(event.created_at || Date.now()),
    errorCode: status === "FAILED" ? event.type : null,
    errorMessage: status === "FAILED" ? (event.data.bounce?.message ?? event.data.bounce?.type ?? event.type) : null,
  });
  return NextResponse.json({ ok: true, outcome });
}
