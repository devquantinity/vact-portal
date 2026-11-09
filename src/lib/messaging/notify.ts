import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { INVITE_TTL_HOURS } from "@/lib/auth/tokens";
import { inviteEmail } from "@/emails/templates";
import { sendEmailMessage, sendWhatsAppMessage } from "./send";

export function appUrl(): string {
  return env().APP_URL.replace(/\/$/, "");
}

export function setPasswordLink(rawToken: string): string {
  return `${appUrl()}/set-password/${rawToken}`;
}

/** Link a client opens from a message: lands on login, then on the request. */
export function requestLink(requestId: string): string {
  return `${appUrl()}/login?next=${encodeURIComponent(`/client/requests/${requestId}`)}`;
}

export function staffRequestLink(companyId: string, requestId: string): string {
  return `${appUrl()}/login?next=${encodeURIComponent(`/staff/companies/${companyId}?request=${requestId}`)}`;
}

/**
 * Emails the set-password link; also sends it by WhatsApp to client contacts with a phone number.
 */
export async function sendInvite(
  user: { id: string; name: string; email: string; phone: string | null; role: "ADMIN" | "STAFF" | "CLIENT" },
  rawToken: string,
  options: { isReset?: boolean } = {},
) {
  const settings = await getSettings();
  const link = setPasswordLink(rawToken);
  const kind = options.isReset ? "PASSWORD_RESET" : "INVITE";
  const rendered = await inviteEmail({
    appUrl: appUrl(),
    brandName: settings.brandName,
    name: user.name,
    link,
    isReset: options.isReset,
    expiresHours: INVITE_TTL_HOURS,
  });
  const email = await sendEmailMessage({
    kind,
    userId: user.id,
    to: user.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
  let whatsapp = null;
  if (user.role === "CLIENT" && user.phone) {
    whatsapp = await sendWhatsAppMessage({
      kind,
      userId: user.id,
      to: user.phone,
      clientName: user.name,
      body: options.isReset
        ? `A password reset was requested for your ${settings.brandName} account. The link below is valid for ${INVITE_TTL_HOURS} hours.`
        : `Your ${settings.brandName} account is ready. Please set your password using the link below (valid for ${INVITE_TTL_HOURS} hours).`,
      link,
    });
  }
  return { email, whatsapp };
}
