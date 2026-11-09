"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require";
import { emptyToNull, fail, parseForm, succeed, type ActionState } from "@/lib/action-utils";
import { normalisePhone } from "@/lib/phone";
import { dateOnlyToDb } from "@/lib/dates";
import { generateToken, inviteExpiry } from "@/lib/auth/tokens";
import { sendInvite } from "@/lib/messaging/notify";

const companySchema = z.object({
  name: z.string().trim().min(2, "Enter the company name."),
  ssmNumber: z.string().trim().min(6, "Enter the SSM registration number."),
  incorporationDate: z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker.").nullable()),
  fyeMonth: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(12).nullable()),
  fyeDay: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(31).nullable()),
  assignedStaffId: z.preprocess(emptyToNull, z.string().nullable()),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
});

function fyeString(month: number | null, day: number | null): string | null {
  if (!month || !day) return null;
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function createCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN", "STAFF");
  const parsed = parseForm(companySchema, formData);
  if (!parsed.success) return fail(parsed.error, parsed.fieldErrors);
  const d = parsed.data;
  const existing = await prisma.company.findUnique({ where: { ssmNumber: d.ssmNumber } });
  if (existing) return fail("A company with this SSM number already exists.", { ssmNumber: "Already registered." });
  const company = await prisma.company.create({
    data: {
      name: d.name,
      ssmNumber: d.ssmNumber,
      incorporationDate: d.incorporationDate ? dateOnlyToDb(d.incorporationDate) : null,
      financialYearEnd: fyeString(d.fyeMonth, d.fyeDay),
      assignedStaffId: d.assignedStaffId,
      status: d.status,
      notes: d.notes,
    },
  });
  await audit(actor.id, "company.created", "Company", company.id, { name: company.name });
  revalidatePath("/admin/companies");
  redirect(`/admin/companies/${company.id}`);
}

export async function updateCompanyAction(companyId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN", "STAFF");
  const parsed = parseForm(companySchema, formData);
  if (!parsed.success) return fail(parsed.error, parsed.fieldErrors);
  const d = parsed.data;
  const clash = await prisma.company.findFirst({ where: { ssmNumber: d.ssmNumber, NOT: { id: companyId } } });
  if (clash) return fail("Another company already uses this SSM number.", { ssmNumber: "Already registered." });
  await prisma.company.update({
    where: { id: companyId },
    data: {
      name: d.name,
      ssmNumber: d.ssmNumber,
      incorporationDate: d.incorporationDate ? dateOnlyToDb(d.incorporationDate) : null,
      financialYearEnd: fyeString(d.fyeMonth, d.fyeDay),
      assignedStaffId: d.assignedStaffId,
      status: d.status,
      notes: d.notes,
    },
  });
  await audit(actor.id, "company.updated", "Company", companyId, { name: d.name, status: d.status });
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin/companies");
  return succeed("Company saved.");
}

const existingContactSchema = z.object({ userId: z.string().min(1, "Pick a client.") });

export async function addExistingContactAction(companyId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN", "STAFF");
  const parsed = parseForm(existingContactSchema, formData);
  if (!parsed.success) return fail(parsed.error, parsed.fieldErrors);
  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user || user.role !== "CLIENT") return fail("That user is not a client account.");
  const count = await prisma.companyContact.count({ where: { companyId } });
  await prisma.companyContact.upsert({
    where: { companyId_userId: { companyId, userId: user.id } },
    update: {},
    create: { companyId, userId: user.id, isPrimary: count === 0 },
  });
  await audit(actor.id, "company.updated", "Company", companyId, { contactAdded: user.email });
  revalidatePath(`/admin/companies/${companyId}`);
  return succeed(`${user.name} linked to this company.`);
}

const newContactSchema = z.object({
  name: z.string().trim().min(2, "Enter the contact's name."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  phone: z.preprocess(emptyToNull, z.string().nullable()),
});

export async function createContactAction(companyId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN", "STAFF");
  const parsed = parseForm(newContactSchema, formData);
  if (!parsed.success) return fail(parsed.error, parsed.fieldErrors);
  const d = parsed.data;
  const phone = d.phone ? normalisePhone(d.phone) : null;
  if (d.phone && !phone) return fail("Enter a valid phone number, e.g. 012-345 6789.", { phone: "Invalid number." });
  const existing = await prisma.user.findUnique({ where: { email: d.email } });
  if (existing) return fail("A user with this email already exists. Use “Link existing client” instead.", { email: "Already registered." });

  const { raw, hash } = generateToken();
  const count = await prisma.companyContact.count({ where: { companyId } });
  const user = await prisma.user.create({
    data: {
      name: d.name,
      email: d.email,
      phone,
      role: "CLIENT",
      status: "INVITED",
      inviteToken: hash,
      inviteExpiresAt: inviteExpiry(),
      companyContacts: { create: { companyId, isPrimary: count === 0 } },
    },
  });
  await audit(actor.id, "user.created", "User", user.id, { role: "CLIENT", email: user.email, companyId });
  await sendInvite(user, raw, { companyId });
  await audit(actor.id, "user.invite_sent", "User", user.id, { email: user.email });
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin/users");
  return succeed(`${user.name} added and invited.`);
}

export async function setPrimaryContactAction(companyId: string, userId: string) {
  const actor = await requireRole("ADMIN", "STAFF");
  await prisma.$transaction([
    prisma.companyContact.updateMany({ where: { companyId }, data: { isPrimary: false } }),
    prisma.companyContact.update({ where: { companyId_userId: { companyId, userId } }, data: { isPrimary: true } }),
  ]);
  await audit(actor.id, "company.updated", "Company", companyId, { primaryContact: userId });
  revalidatePath(`/admin/companies/${companyId}`);
}

export async function removeContactAction(companyId: string, userId: string) {
  const actor = await requireRole("ADMIN", "STAFF");
  await prisma.companyContact.delete({ where: { companyId_userId: { companyId, userId } } });
  await audit(actor.id, "company.updated", "Company", companyId, { contactRemoved: userId });
  revalidatePath(`/admin/companies/${companyId}`);
}
