import { prisma, type Channel, type MessageLog } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { daysLeft, describeDaysLeft, formatDueDate } from "@/lib/dates";
import { renderTemplate } from "@/lib/templates/render";
import { buildTemplateVars } from "@/lib/templates/vars";
import { channelsFor } from "@/lib/reminders/schedule";
import { formatPhone } from "@/lib/phone";
import {
  approvedEmail,
  changesRequestedEmail,
  escalationEmail,
  reminderEmail,
  requestCreatedEmail,
  uploadReceivedEmail,
} from "@/emails/templates";
import { appUrl, emailFor, requestLink, staffRequestLink } from "./notify";
import { sendEmailMessage, sendWhatsAppMessage } from "./send";

const requestInclude = {
  company: { include: { contacts: { include: { user: true } }, assignedStaff: true } },
  documentType: true,
  reminderType: true,
} as const;

export async function loadRequestForMessaging(requestId: string) {
  const request = await prisma.documentRequest.findUnique({ where: { id: requestId }, include: requestInclude });
  if (!request) throw new Error(`Request ${requestId} not found`);
  return request;
}

export type RequestForMessaging = Awaited<ReturnType<typeof loadRequestForMessaging>>;

function activeContacts(request: RequestForMessaging) {
  return request.company.contacts.map((c) => c.user).filter((u) => u.status !== "DISABLED");
}

/**
 * Sends the reminder type's templates to every contact on the request's company over the given channels.
 * Used for the "new request" notification (job 0) and by the scheduler for reminders.
 */
export async function sendTemplatedToContacts(
  request: RequestForMessaging,
  options: { channels: Channel[]; kind: "NEW_REQUEST" | "REMINDER"; jobId?: string | null; now?: Date },
): Promise<MessageLog[]> {
  const settings = await getSettings();
  const contacts = activeContacts(request);
  const logs: MessageLog[] = [];
  const now = options.now ?? new Date();
  for (const contact of contacts) {
    const link = requestLink(request.id);
    const vars = buildTemplateVars({ request, contactName: contact.name, staff: request.company.assignedStaff, settings, link, now });
    const common = { kind: options.kind, userId: contact.id, companyId: request.companyId, requestId: request.id, jobId: options.jobId ?? null };

    if (options.channels.includes("WHATSAPP") && contact.phone) {
      const body = renderTemplate(request.reminderType.whatsappBody, vars).text;
      logs.push(await sendWhatsAppMessage({ ...common, to: contact.phone, clientName: contact.name, body, link }));
    }
    if (options.channels.includes("EMAIL") && contact.email) {
      const subject = renderTemplate(request.reminderType.emailSubject, vars).text;
      const body = renderTemplate(request.reminderType.emailBody, vars).text;
      const rendered =
        options.kind === "NEW_REQUEST"
          ? await requestCreatedEmail({
              appUrl: appUrl(),
              brandName: settings.brandName,
              clientName: contact.name,
              company: request.company.name,
              document: request.documentType.name,
              dueDate: vars.due_date,
              instructions: request.instructions,
              staffName: vars.staff_name,
              link,
              subject,
              body,
            })
          : await reminderEmail({
              appUrl: appUrl(),
              brandName: settings.brandName,
              subject,
              body,
              company: request.company.name,
              document: request.documentType.name,
              dueDate: vars.due_date,
              daysLeft: vars.days_left,
              link,
              staffName: vars.staff_name,
            });
      logs.push(await sendEmailMessage({ ...common, to: emailFor(contact), subject: rendered.subject, html: rendered.html, text: rendered.text }));
    }
  }
  return logs;
}

/** Job 0: tell the client contacts a new request exists, on the reminder type's channels. */
export async function notifyNewRequest(requestId: string) {
  const request = await loadRequestForMessaging(requestId);
  return sendTemplatedToContacts(request, { channels: channelsFor(request.reminderType.channel), kind: "NEW_REQUEST" });
}

/** Staff decision: changes requested. Email always, WhatsApp when the reminder type allows it. */
export async function notifyChangesRequested(requestId: string, comment: string, reviewerName: string) {
  const request = await loadRequestForMessaging(requestId);
  const settings = await getSettings();
  const link = requestLink(request.id);
  const channels = channelsFor(request.reminderType.channel);
  for (const contact of activeContacts(request)) {
    const common = { kind: "CHANGES_REQUESTED" as const, userId: contact.id, companyId: request.companyId, requestId: request.id };
    if (contact.email) {
      const rendered = await changesRequestedEmail({
        appUrl: appUrl(),
        brandName: settings.brandName,
        clientName: contact.name,
        company: request.company.name,
        document: request.documentType.name,
        comment,
        staffName: reviewerName,
        link,
      });
      await sendEmailMessage({ ...common, to: emailFor(contact), subject: rendered.subject, html: rendered.html, text: rendered.text });
    }
    if (channels.includes("WHATSAPP") && contact.phone) {
      await sendWhatsAppMessage({
        ...common,
        to: contact.phone,
        clientName: contact.name,
        body: `${reviewerName} reviewed the ${request.documentType.name} you uploaded for ${request.company.name} and needs a correction: "${comment}". Please upload a corrected file.`,
        link,
      });
    }
  }
}

/** Staff decision: approved. */
export async function notifyApproved(requestId: string, reviewerName: string) {
  const request = await loadRequestForMessaging(requestId);
  const settings = await getSettings();
  const link = requestLink(request.id);
  const channels = channelsFor(request.reminderType.channel);
  for (const contact of activeContacts(request)) {
    const common = { kind: "APPROVED" as const, userId: contact.id, companyId: request.companyId, requestId: request.id };
    if (contact.email) {
      const rendered = await approvedEmail({
        appUrl: appUrl(),
        brandName: settings.brandName,
        clientName: contact.name,
        company: request.company.name,
        document: request.documentType.name,
        staffName: reviewerName,
        link,
      });
      await sendEmailMessage({ ...common, to: emailFor(contact), subject: rendered.subject, html: rendered.html, text: rendered.text });
    }
    if (channels.includes("WHATSAPP") && contact.phone) {
      await sendWhatsAppMessage({
        ...common,
        to: contact.phone,
        clientName: contact.name,
        body: `Good news: ${reviewerName} has approved the ${request.documentType.name} for ${request.company.name}. Nothing more is needed for this item.`,
        link,
      });
    }
  }
}

/** Staff who should hear about a request: the assigned officer, or every admin as a fallback. */
export async function staffRecipientsFor(request: RequestForMessaging) {
  if (request.company.assignedStaff && request.company.assignedStaff.status === "ACTIVE") return [request.company.assignedStaff];
  return prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" } });
}

/** A client (or staff) uploaded: email the assigned staff. */
export async function notifyUploadReceived(requestId: string, uploadedByName: string, fileNames: string[]) {
  const request = await loadRequestForMessaging(requestId);
  const settings = await getSettings();
  for (const staff of await staffRecipientsFor(request)) {
    const rendered = await uploadReceivedEmail({
      appUrl: appUrl(),
      brandName: settings.brandName,
      staffName: staff.name,
      company: request.company.name,
      document: request.documentType.name,
      uploadedBy: uploadedByName,
      fileNames: fileNames.join(", "),
      link: staffRequestLink(request.companyId, request.id),
    });
    await sendEmailMessage({
      kind: "UPLOAD_RECEIVED",
      userId: staff.id,
      companyId: request.companyId,
      requestId: request.id,
      to: emailFor(staff),
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }
}

/** Reminder threshold hit: email the officer (or admins) and return who was notified. */
export async function notifyEscalation(request: RequestForMessaging, remindersSent: number, now: Date = new Date()) {
  const settings = await getSettings();
  const recipients = await staffRecipientsFor(request);
  const contacts = activeContacts(request)
    .map((c) => `${c.name} (${[c.phone ? formatPhone(c.phone) : null, c.email].filter(Boolean).join(", ")})`)
    .join("; ");
  for (const staff of recipients) {
    const rendered = await escalationEmail({
      appUrl: appUrl(),
      brandName: settings.brandName,
      staffName: staff.name,
      company: request.company.name,
      document: request.documentType.name,
      dueDate: formatDueDate(request.dueDate),
      daysLeft: describeDaysLeft(daysLeft(request.dueDate, now)),
      remindersSent,
      contacts: contacts || "No contacts on file",
      link: staffRequestLink(request.companyId, request.id),
    });
    await sendEmailMessage({
      kind: "ESCALATION",
      userId: staff.id,
      companyId: request.companyId,
      requestId: request.id,
      to: emailFor(staff),
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }
  return recipients;
}
