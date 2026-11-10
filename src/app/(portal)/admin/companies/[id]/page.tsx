import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
  // Older links opened a request in a dialog on this page; requests now have their own page.
  if (typeof sp.request === "string") redirect(`/staff/requests/${sp.request}`);
  return (
    <CompanyDetail
      companyId={id}
      tab={parseCompanyTab(sp.tab)}
      viewer={viewer}
      basePath={`/admin/companies/${id}`}
    />
  );
}
