import type { Metadata } from "next";
import { getSettings, workerHeartbeat } from "@/lib/settings";
import { env } from "@/lib/env";
import { emailMode } from "@/lib/messaging/email";
import { whatsappMode } from "@/lib/messaging/whatsapp";
import { formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { DetailList } from "@/components/shared/detail-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/admin/settings-form";
import { RunRemindersCard } from "@/components/admin/run-reminders-card";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getSettings();
  const { lastTickDate, workerAlive } = await workerHeartbeat();
  const e = env();

  return (
    <>
      <PageHeader title="Settings" description="Sending rules, portal name and the reminder scheduler." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sending rules</CardTitle>
            <CardDescription>Reminders outside the window are held until it opens again.</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingsForm settings={settings} />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <RunRemindersCard lastTick={lastTickDate ? formatDateTime(lastTickDate, "d MMM yyyy, HH:mm:ss") : null} workerAlive={workerAlive} />
          <Card>
            <CardHeader>
              <CardTitle>Providers</CardTitle>
              <CardDescription>Read from the environment file. Simulated channels log messages without sending.</CardDescription>
            </CardHeader>
            <CardContent>
              <DetailList
                items={[
                  {
                    label: "WhatsApp",
                    value: (
                      <span className="flex items-center gap-2">
                        <Badge variant={whatsappMode() === "live" ? "approved" : "pending"}>{whatsappMode() === "live" ? "Live" : "Simulated"}</Badge>
                        <span className="text-xs text-muted-foreground">Graph API {e.GRAPH_API_VERSION} · template {e.WHATSAPP_TEMPLATE_NAME}</span>
                      </span>
                    ),
                  },
                  {
                    label: "Email",
                    value: (
                      <span className="flex items-center gap-2">
                        <Badge variant={emailMode() === "live" ? "approved" : "pending"}>{emailMode() === "live" ? "Live (Resend)" : "Simulated"}</Badge>
                        <span className="text-xs text-muted-foreground truncate">{e.EMAIL_FROM}</span>
                      </span>
                    ),
                  },
                  { label: "Timezone", value: settings.timezone },
                  { label: "Portal URL", value: e.APP_URL },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
