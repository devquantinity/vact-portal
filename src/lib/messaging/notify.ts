import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { INVITE_TTL_HOURS } from "@/lib/auth/tokens";
import { inviteEmail } from "@/emails/templates";
import { sendEmailMessage, sendWhatsAppMessage } from "./send";

/** The address notifications go to: the login email unless a separate notification email is set. */
export function emailFor(user: { email: string; notificationEmail?: string | null }): string {
  return user.notificationEmail?.trim() || user.email;
}

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

export function staffRequestLink(requestId: string): string {
  return `${appUrl()}/login?next=${encodeURIComponent(`/staff/requests/${requestId}`)}`;
}

/**
 * Emails the set-password link; also sends it by WhatsApp to client contacts with a phone number.
 */
export async function sendInvite(
  user: { id: string; name: string; email: string; notificationEmail?: string | null; phone: string | null; role: "ADMIN" | "STAFF" | "CLIENT" },
  rawToken: string,
  options: { isReset?: boolean; companyId?: string | null } = {},
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
    companyId: options.companyId ?? null,
    to: emailFor(user),
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
  let whatsapp = null;
  if (user.role === "CLIENT" && user.phone) {
    whatsapp = await sendWhatsAppMessage({
      kind,
      userId: user.id,
      companyId: options.companyId ?? null,
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
