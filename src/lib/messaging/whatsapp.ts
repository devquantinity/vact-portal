import { env } from "@/lib/env";
import { simulatedId, type DeliveryResult } from "./types";

/**
 * The one approved utility template (see README → WhatsApp). Each parameter sits inside fixed text so
 * the admin's free-text reminder body can travel as parameter 2 while staying inside Meta's rules.
 */
export const WHATSAPP_TEMPLATE_TEXT =
  "Hello {{1}}, this is a message from V ACT Management Services about your company. Details: {{2}} You can open your portal at {{3}} to upload the documents. Thank you.";

const META_BODY_LIMIT = 1024;

export function whatsappMode(): "live" | "simulate" {
  return env().WHATSAPP_MODE;
}

/** Meta parameter values: no newlines or tabs, never more than 4 spaces in a row. */
export function collapseWhitespace(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

export function truncate(text: string, max: number): string {
  if (max <= 0) return "";
  if (text.length <= max) return text;
  if (max <= 3) return text.slice(0, max);
  return `${text.slice(0, max - 3).trimEnd()}...`;
}

/**
 * Fills the template with the three parameters, keeping the whole message under Meta's 1,024 character
 * cap by collapsing the free-text body to one line and truncating it with "..." when needed.
 */
export function composeTemplateMessage(params: { clientName: string; body: string; link: string }): {
  parameters: [string, string, string];
  text: string;
} {
  const fixedLength = WHATSAPP_TEMPLATE_TEXT.replace(/\{\{\d\}\}/g, "").length;
  const name = collapseWhitespace(params.clientName) || "there";
  const link = collapseWhitespace(params.link);
  const room = META_BODY_LIMIT - fixedLength - name.length - link.length - 4;
  const body = truncate(collapseWhitespace(params.body), Math.max(room, 20));
  const parameters: [string, string, string] = [name, body, link];
  const text = WHATSAPP_TEMPLATE_TEXT.replace("{{1}}", name).replace("{{2}}", body).replace("{{3}}", link);
  return { parameters, text };
}

type MetaError = { error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } } };
type MetaSendResponse = { messages?: { id: string; message_status?: string }[] } & MetaError;

/**
 * Sends a template message via the WhatsApp Cloud API (Graph API). In simulate mode there is no
 * network call: a fake wamid "sim-<uuid>" is returned and the worker advances the status later.
 */
export async function deliverWhatsApp(params: {
  to: string; // E.164
  clientName: string;
  body: string;
  link: string;
}): Promise<DeliveryResult & { text: string }> {
  const { parameters, text } = composeTemplateMessage(params);
  if (whatsappMode() === "simulate") {
    return { ok: true, providerMessageId: simulatedId("sim"), simulated: true, text };
  }
  const e = env();
  if (!e.WHATSAPP_PHONE_NUMBER_ID || !e.WHATSAPP_ACCESS_TOKEN) {
    return {
      ok: false,
      errorCode: "whatsapp_not_configured",
      errorMessage: "WHATSAPP_MODE=live but WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN is missing",
      text,
    };
  }
  const url = `https://graph.facebook.com/${e.GRAPH_API_VERSION}/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to.replace(/^\+/, ""),
    type: "template",
    template: {
      name: e.WHATSAPP_TEMPLATE_NAME,
      language: { code: e.WHATSAPP_TEMPLATE_LANGUAGE },
      components: [
        {
          type: "body",
          parameters: parameters.map((value) => ({ type: "text", text: value })),
        },
      ],
    },
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${e.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as MetaSendResponse;
    if (!res.ok || json.error) {
      const err = json.error;
      const code = err?.code != null ? `${err.code}${err.error_subcode ? `/${err.error_subcode}` : ""}` : `http_${res.status}`;
      const message = [err?.message, err?.error_data?.details].filter(Boolean).join(" — ") || `HTTP ${res.status}`;
      return { ok: false, errorCode: code, errorMessage: message, text };
    }
    const id = json.messages?.[0]?.id;
    if (!id) return { ok: false, errorCode: "whatsapp_no_id", errorMessage: "Meta returned no message id", text };
    return { ok: true, providerMessageId: id, simulated: false, text };
  } catch (err) {
    return {
      ok: false,
      errorCode: "whatsapp_exception",
      errorMessage: err instanceof Error ? err.message : String(err),
      text,
    };
  }
}
