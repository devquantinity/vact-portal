"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require";
import { fail, parseForm, succeed, type ActionState } from "@/lib/action-utils";
import { saveSettings } from "@/lib/settings";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm, e.g. 09:00");

const schema = z
  .object({
    brandName: z.string().trim().min(2, "Enter the portal name.").max(60),
    sendWindowStart: time,
    sendWindowEnd: time,
    skipWeekends: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    staffPhone: z.string().trim().min(6, "Enter the office phone shown to clients."),
  })
  .refine((d) => d.sendWindowStart < d.sendWindowEnd, {
    message: "The send window must start before it ends.",
    path: ["sendWindowEnd"],
  });

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  const parsed = parseForm(schema, formData);
  if (!parsed.success) return fail(parsed.error, parsed.fieldErrors);
  await saveSettings(parsed.data);
  await audit(actor.id, "settings.changed", "Setting", "*", parsed.data);
  revalidatePath("/", "layout");
  return succeed("Settings saved.");
}
