import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentTypesPanel } from "@/components/admin/document-types-panel";

export const metadata: Metadata = { title: "Document types" };

export default async function DocumentTypesPage() {
  const types = await prisma.documentType.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { requests: true } } },
  });
  return (
    <>
      <PageHeader title="Document types" description="The documents V ACT asks clients for, with the file rules the portal enforces on upload." />
      <DocumentTypesPanel
        items={types.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          acceptedExtensions: t.acceptedExtensions,
          maxSizeMb: t.maxSizeMb,
          allowMultipleFiles: t.allowMultipleFiles,
          active: t.active,
          requestCount: t._count.requests,
        }))}
      />
    </>
  );
}
