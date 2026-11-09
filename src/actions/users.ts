"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require";
import { emptyToNull, fail, parseForm, succeed, type ActionState } from "@/lib/action-utils";
import { normalisePhone } from "@/lib/phone";
import { generateToken, inviteExpiry } from "@/lib/auth/tokens";
import { sendInvite } from "@/lib/messaging/notify";

const userSchema = z.object({
  role: z.enum(["ADMIN", "STAFF", "CLIENT"]),
  name: z.string().trim().min(2, "Enter the person's name."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  phone: z.preprocess(emptyToNull, z.string().nullable()),
  companyId: z.preprocess(emptyToNull, z.string().nullable()),
});

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  const parsed = parseForm(userSchema, formData);
  if (!parsed.success) return fail(parsed.error, parsed.fieldErrors);
  const d = parsed.data;
  const phone = d.phone ? normalisePhone(d.phone) : null;
  if (d.phone && !phone) return fail("Enter a valid phone number, e.g. 012-345 6789.", { phone: "Invalid number." });
  if (d.role === "CLIENT" && !phone) return fail("Client contacts need a WhatsApp number.", { phone: "Required for clients." });
  const existing = await prisma.user.findUnique({ where: { email: d.email } });
  if (existing) return fail("A user with this email already exists.", { email: "Already registered." });

  const { raw, hash } = generateToken();
  const user = await prisma.user.create({
    data: {
      name: d.name,
      email: d.email,
      phone,
      role: d.role,
      status: "INVITED",
      inviteToken: hash,
      inviteExpiresAt: inviteExpiry(),
      ...(d.role === "CLIENT" && d.companyId
        ? { companyContacts: { create: { companyId: d.companyId, isPrimary: false } } }
        : {}),
    },
  });
  await audit(actor.id, "user.created", "User", user.id, { role: user.role, email: user.email });
  await sendInvite(user, raw, { companyId: d.role === "CLIENT" ? d.companyId : null });
  await audit(actor.id, "user.invite_sent", "User", user.id, { email: user.email });
  revalidatePath("/admin/users");
  if (d.companyId) revalidatePath(`/admin/companies/${d.companyId}`);
  return succeed(`${user.name} created and invited by email${user.role === "CLIENT" && phone ? " and WhatsApp" : ""}.`);
}

export async function resendInviteAction(userId: string): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return fail("User not found.");
  if (user.status === "DISABLED") return fail("Enable the account before resending an invite.");
  const { raw, hash } = generateToken();
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { inviteToken: hash, inviteExpiresAt: inviteExpiry() },
  });
  await sendInvite(updated, raw, { isReset: user.status === "ACTIVE" });
  await audit(actor.id, "user.invite_sent", "User", user.id, { email: user.email, resend: true });
  revalidatePath("/admin/users");
  return succeed(`Invitation sent to ${user.email}.`);
}

export async function setUserDisabledAction(userId: string, disabled: boolean): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  if (actor.id === userId) return fail("You cannot disable your own account.");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return fail("User not found.");
  const status = disabled ? "DISABLED" : user.passwordHash ? "ACTIVE" : "INVITED";
  await prisma.user.update({ where: { id: userId }, data: { status } });
  await audit(actor.id, disabled ? "user.disabled" : "user.enabled", "User", userId, { email: user.email });
  revalidatePath("/admin/users");
  return succeed(disabled ? `${user.name} disabled.` : `${user.name} enabled.`);
}
