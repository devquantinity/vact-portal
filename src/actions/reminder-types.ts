"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require";
import { emptyToNull, fail, parseForm, succeed, type ActionState } from "@/lib/action-utils";
import { findUnknownPlaceholders, renderTemplate, sampleVars } from "@/lib/templates/render";
import { getSettings } from "@/lib/settings";
import { appUrl, emailFor } from "@/lib/messaging/notify";
import { sendEmailMessage, sendWhatsAppMessage } from "@/lib/messaging/send";
import { testEmail } from "@/emails/templates";
import { FIRM_NAME } from "@/lib/env";

const daysList = z
  .string()
  .transform((s) =>
    s
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter(Boolean)
      .map(Number),
  )
  .pipe(z.array(z.number().int("Days must be whole numbers.").min(0).max(365)))
  .transform((arr) => [...new Set(arr)].sort((a, b) => b - a));

const schema = z.object({
  name: z.string().trim().min(2, "Enter a name."),
  description: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
  channel: z.enum(["WHATSAPP", "EMAIL", "BOTH"]),
  daysBefore: daysList,
  repeatEveryDays: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(90).nullable()),
  escalateAfter: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(50).nullable()),
  whatsappBody: z.string().trim().min(10, "Write the WhatsApp message."),
  emailSubject: z.string().trim().min(3, "Write the email subject."),
  emailBody: z.string().trim().min(10, "Write the email body."),
  active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export type ReminderTypeInput = z.infer<typeof schema>;

function validateTemplates(d: ReminderTypeInput): string | null {
  const unknown = [
    ...findUnknownPlaceholders(d.whatsappBody),
    ...findUnknownPlaceholders(d.emailSubject),
    ...findUnknownPlaceholders(d.emailBody),
  ];
  if (unknown.length) return `Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${[...new Set(unknown)].map((u) => `{${u}}`).join(", ")}`;
  return null;
}

export async function saveReminderTypeAction(id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  const parsed = parseForm(schema, formData);
  if (!parsed.success) return fail(parsed.error, parsed.fieldErrors);
  const d = parsed.data;
  const templateError = validateTemplates(d);
  if (templateError) return fail(templateError);
  const clash = await prisma.reminderType.findFirst({ where: { name: d.name, NOT: id ? { id } : undefined } });
  if (clash) return fail("Another reminder type already uses this name.", { name: "Already exists." });

  if (id) {
    await prisma.reminderType.update({ where: { id }, data: d });
    await audit(actor.id, "reminder_type.changed", "ReminderType", id, { name: d.name });
    revalidatePath("/admin/reminder-types");
    revalidatePath(`/admin/reminder-types/${id}`);
    return succeed("Reminder type saved.");
  }
  const created = await prisma.reminderType.create({ data: d });
  await audit(actor.id, "reminder_type.changed", "ReminderType", created.id, { created: true, name: d.name });
  revalidatePath("/admin/reminder-types");
  redirect(`/admin/reminder-types/${created.id}?created=1`);
}

export async function toggleReminderTypeAction(id: string, active: boolean): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  const rt = await prisma.reminderType.update({ where: { id }, data: { active } });
  await audit(actor.id, "reminder_type.changed", "ReminderType", id, { active, name: rt.name });
  revalidatePath("/admin/reminder-types");
  return succeed(active ? `${rt.name} is active.` : `${rt.name} hidden from new requests.`);
}

export async function deleteReminderTypeAction(id: string): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  const used = await prisma.documentRequest.count({ where: { reminderTypeId: id } });
  if (used > 0) return fail(`Used by ${used} request${used === 1 ? "" : "s"}. Deactivate it instead.`);
  const rt = await prisma.reminderType.delete({ where: { id } });
  await audit(actor.id, "reminder_type.changed", "ReminderType", id, { deleted: true, name: rt.name });
  revalidatePath("/admin/reminder-types");
  redirect("/admin/reminder-types");
}

const testSchema = schema.pick({ channel: true, whatsappBody: true, emailSubject: true, emailBody: true });

/** Sends the templates, rendered with sample data, to the signed-in admin's own phone and email. */
export async function sendTestMessageAction(
  _prev: ActionState<{ whatsapp?: string; email?: string }>,
  formData: FormData,
): Promise<ActionState<{ whatsapp?: string; email?: string }>> {
  const actor = await requireRole("ADMIN");
  const parsed = parseForm(testSchema, formData);
  if (!parsed.success) return fail(parsed.error, parsed.fieldErrors);
  const d = parsed.data;
  const settings = await getSettings();
  const vars = sampleVars({
    client_name: actor.name,
    link: `${appUrl()}/login`,
    staff_name: actor.name,
    staff_phone: settings.staffPhone,
    firm: FIRM_NAME,
  });
  const results: { whatsapp?: string; email?: string } = {};

  if (d.channel !== "EMAIL") {
    if (!actor.phone) {
      results.whatsapp = "No phone number on your account, WhatsApp test skipped.";
    } else {
      const log = await sendWhatsAppMessage({
        kind: "TEST",
        userId: actor.id,
        to: actor.phone,
        clientName: actor.name,
        body: renderTemplate(d.whatsappBody, vars).text,
        link: vars.link,
      });
      results.whatsapp =
        log.status === "FAILED"
          ? `WhatsApp failed: ${log.errorMessage ?? log.errorCode ?? "unknown error"}`
          : `WhatsApp ${log.simulated ? "simulated" : "sent"} to ${actor.phone}.`;
    }
  }
  if (d.channel !== "WHATSAPP") {
    const rendered = await testEmail({
      appUrl: appUrl(),
      brandName: settings.brandName,
      subject: renderTemplate(d.emailSubject, vars).text,
      body: renderTemplate(d.emailBody, vars).text,
      link: vars.link,
    });
    const log = await sendEmailMessage({
      kind: "TEST",
      userId: actor.id,
      to: emailFor(actor),
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    results.email =
      log.status === "FAILED"
        ? `Email failed: ${log.errorMessage ?? log.errorCode ?? "unknown error"}`
        : `Email ${log.simulated ? "simulated" : "sent"} to ${emailFor(actor)}.`;
  }
  await audit(actor.id, "message.test_sent", "ReminderType", "test", results);
  const failed = Object.values(results).some((r) => r.includes("failed"));
  return failed ? { ok: false, error: Object.values(results).join(" ") } : succeed(Object.values(results).join(" "), results);
}
