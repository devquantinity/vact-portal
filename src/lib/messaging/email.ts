import { Resend } from "resend";
import { env } from "@/lib/env";
import { simulatedId, type DeliveryResult } from "./types";

let client: Resend | null = null;

export function emailMode(): "live" | "simulate" {
  return env().RESEND_API_KEY ? "live" : "simulate";
}

function resend(): Resend {
  if (!client) client = new Resend(env().RESEND_API_KEY);
  return client;
}

/**
 * Sends one email through Resend. Without RESEND_API_KEY the message is simulated:
 * no network call, a fake provider id, and the worker later marks it delivered and read.
 */
export async function deliverEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<DeliveryResult> {
  if (emailMode() === "simulate") {
    return { ok: true, providerMessageId: simulatedId("sim-email"), simulated: true };
  }
  try {
    const { data, error } = await resend().emails.send({
      from: env().EMAIL_FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) {
      return { ok: false, errorCode: error.name ?? "resend_error", errorMessage: error.message };
    }
    if (!data?.id) {
      return { ok: false, errorCode: "resend_no_id", errorMessage: "Resend returned no message id" };
    }
    return { ok: true, providerMessageId: data.id, simulated: false };
  } catch (err) {
    return { ok: false, errorCode: "resend_exception", errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
