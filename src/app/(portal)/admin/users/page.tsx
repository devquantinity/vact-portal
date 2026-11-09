import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/require";
import { formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { LinkTabs } from "@/components/shared/link-tabs";
import { NewUserDialog, UsersTable, type UserRow } from "@/components/admin/users-panel";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage(props: PageProps<"/admin/users">) {
  const me = await requireRole("ADMIN");
  const sp = await props.searchParams;
  const tab = sp.tab === "clients" ? "clients" : "staff";

  const [users, companies] = await Promise.all([
    prisma.user.findMany({
      where: tab === "clients" ? { role: "CLIENT" } : { role: { in: ["ADMIN", "STAFF"] } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: { companyContacts: { include: { company: { select: { id: true, name: true } } } } },
    }),
    prisma.company.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const counts = await prisma.user.groupBy({ by: ["role"], _count: { _all: true } });
  const staffCount = counts.filter((c) => c.role !== "CLIENT").reduce((n, c) => n + c._count._all, 0);
  const clientCount = counts.find((c) => c.role === "CLIENT")?._count._all ?? 0;

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    lastLoginAt: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : null,
    companies: u.companyContacts.map((cc) => cc.company),
  }));

  return (
    <>
      <PageHeader
        title="Users"
        description="V ACT team members and client logins. Invites expire after 48 hours and can be resent any time."
        actions={<NewUserDialog defaultRole={tab === "clients" ? "CLIENT" : "STAFF"} companies={companies} />}
      />
      <LinkTabs
        current={tab}
        hrefFor={(k) => `/admin/users?tab=${k}`}
        tabs={[
          { key: "staff", label: "Staff", count: staffCount },
          { key: "clients", label: "Clients", count: clientCount },
        ]}
      />
      <UsersTable users={rows} kind={tab} meId={me.id} />
    </>
  );
}
