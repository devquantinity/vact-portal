"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require";
import { emptyToNull, fail, parseForm, succeed, type ActionState } from "@/lib/action-utils";
import { ALLOWED_EXTENSIONS } from "@/lib/files/extensions";

const schema = z.object({
  name: z.string().trim().min(2, "Enter a name."),
  description: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
  acceptedExtensions: z
    .string()
    .transform((s) =>
      s
        .split(/[,\s]+/)
        .map((e) => e.trim().toLowerCase().replace(/^\./, ""))
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(ALLOWED_EXTENSIONS)).min(1, "Pick at least one file type.")),
  maxSizeMb: z.coerce.number().int().min(1).max(100).default(10),
  allowMultipleFiles: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export async function createDocumentTypeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  const parsed = parseForm(schema, formData);
  if (!parsed.success) return fail(parsed.error, parsed.fieldErrors);
  const d = parsed.data;
  if (await prisma.documentType.findUnique({ where: { name: d.name } })) {
    return fail("A document type with this name already exists.", { name: "Already exists." });
  }
  const max = await prisma.documentType.aggregate({ _max: { sortOrder: true } });
  const dt = await prisma.documentType.create({
    data: { ...d, sortOrder: (max._max.sortOrder ?? -1) + 1, active: true },
  });
  await audit(actor.id, "document_type.changed", "DocumentType", dt.id, { created: true, name: dt.name });
  revalidatePath("/admin/document-types");
  return succeed("Document type created.");
}

export async function updateDocumentTypeAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  const parsed = parseForm(schema, formData);
  if (!parsed.success) return fail(parsed.error, parsed.fieldErrors);
  const d = parsed.data;
  const clash = await prisma.documentType.findFirst({ where: { name: d.name, NOT: { id } } });
  if (clash) return fail("Another document type already uses this name.", { name: "Already exists." });
  await prisma.documentType.update({ where: { id }, data: d });
  await audit(actor.id, "document_type.changed", "DocumentType", id, { name: d.name });
  revalidatePath("/admin/document-types");
  return succeed("Document type saved.");
}

export async function toggleDocumentTypeAction(id: string, active: boolean): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  const dt = await prisma.documentType.update({ where: { id }, data: { active } });
  await audit(actor.id, "document_type.changed", "DocumentType", id, { active, name: dt.name });
  revalidatePath("/admin/document-types");
  return succeed(active ? `${dt.name} is active.` : `${dt.name} hidden from new requests.`);
}

export async function reorderDocumentTypesAction(orderedIds: string[]): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.documentType.update({ where: { id }, data: { sortOrder: index } })),
  );
  await audit(actor.id, "document_type.changed", "DocumentType", "*", { reordered: orderedIds.length });
  revalidatePath("/admin/document-types");
  return succeed();
}

export async function deleteDocumentTypeAction(id: string): Promise<ActionState> {
  const actor = await requireRole("ADMIN");
  const used = await prisma.documentRequest.count({ where: { documentTypeId: id } });
  if (used > 0) return fail(`Used by ${used} request${used === 1 ? "" : "s"}. Deactivate it instead.`);
  const dt = await prisma.documentType.delete({ where: { id } });
  await audit(actor.id, "document_type.changed", "DocumentType", id, { deleted: true, name: dt.name });
  revalidatePath("/admin/document-types");
  return succeed("Document type deleted.");
}
