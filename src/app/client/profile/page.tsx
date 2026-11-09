import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require";
import { clientCompanies } from "@/lib/requests/client-queries";
import { formatPhone } from "@/lib/phone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailList } from "@/components/shared/detail-list";
import { ChangePasswordForm } from "@/components/client/change-password-form";

export const metadata: Metadata = { title: "My profile" };

export default async function ClientProfilePage() {
  const me = await requireRole("CLIENT");
  const companies = await clientCompanies(me.id);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">My profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
          <CardDescription>Reminders go to these. To change them, ask your V ACT officer.</CardDescription>
        </CardHeader>
        <CardContent>
          <DetailList
            items={[
              { label: "Name", value: me.name },
              { label: "Email", value: me.notificationEmail && me.notificationEmail !== me.email ? `${me.notificationEmail} (sign in with ${me.email})` : me.email },
              { label: "WhatsApp", value: me.phone ? formatPhone(me.phone) : "Not on file" },
              { label: "Companies", value: companies.map((c) => c.name).join(", ") || "None linked" },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
