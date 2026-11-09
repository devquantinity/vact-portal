import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { CHANNEL_LABEL, MESSAGE_KIND_LABEL } from "@/lib/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageStatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import type { recentMessages } from "@/lib/dashboard/queries";

type Row = Awaited<ReturnType<typeof recentMessages>>[number];

export function RecentMessages({ rows, moreHref }: { rows: Row[]; moreHref?: string }) {
  return (
    <Card className="py-0 gap-0 overflow-hidden">
      <CardHeader className="py-4">
        <CardTitle className="flex items-center justify-between">
          Recent messages
          {moreHref ? (
            <Link href={moreHref} className="text-sm font-medium text-primary hover:underline">
              Full delivery log
            </Link>
          ) : null}
        </CardTitle>
        <CardDescription>Latest WhatsApp and email activity with delivery status.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState compact icon={MessagesSquare} title="No messages yet" />
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-medium">{CHANNEL_LABEL[m.channel]}</span> · {MESSAGE_KIND_LABEL[m.kind] ?? m.kind} to {m.user?.name ?? (m.channel === "WHATSAPP" ? formatPhone(m.recipient) : m.recipient)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.company?.name ?? "—"}
                    {m.request ? ` · ${m.request.documentType.name}` : ""} · {formatDateTime(m.queuedAt, "d MMM, HH:mm")}
                  </p>
                </div>
                <MessageStatusBadge status={m.status} simulated={m.simulated} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
