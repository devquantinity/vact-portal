import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/require";
import { CompanyDetail, parseCompanyTab } from "@/components/company/company-detail";

export async function generateMetadata(props: PageProps<"/admin/companies/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const company = await prisma.company.findUnique({ where: { id }, select: { name: true } });
  return { title: company?.name ?? "Company" };
}

export default async function AdminCompanyPage(props: PageProps<"/admin/companies/[id]">) {
  const viewer = await requireRole("ADMIN");
  const { id } = await props.params;
  const sp = await props.searchParams;
  return (
    <CompanyDetail
      companyId={id}
      tab={sp.request ? "requests" : parseCompanyTab(sp.tab)}
      viewer={viewer}
      basePath={`/admin/companies/${id}`}
      requestsBasePath={`/staff/companies/${id}`}
      openRequestId={typeof sp.request === "string" ? sp.request : undefined}
    />
  );
}
