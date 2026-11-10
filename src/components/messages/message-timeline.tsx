"use client";

import { useState } from "react";
import { Check, CheckCheck, Clock, Eye, Send, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { TZ } from "@/lib/dates";
import { CHANNEL_LABEL, MESSAGE_KIND_LABEL } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageStatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

export type MessageView = {
  id: string;
  channel: "WHATSAPP" | "EMAIL";
  kind: string;
  recipient: string;
  recipientName: string | null;
  subject: string | null;
  renderedBody: string;
  status: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  simulated: boolean;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  queuedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
};

function fmt(iso: string | null) {
  if (!iso) return null;
  return format(toZonedTime(new Date(iso), TZ), "d MMM yyyy, HH:mm:ss");
}

export function MessageTimeline({ message, trigger }: { message: MessageView; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button variant="ghost" size="sm">
            Details
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {CHANNEL_LABEL[message.channel]} · {MESSAGE_KIND_LABEL[message.kind] ?? message.kind}
              <MessageStatusBadge status={message.status} simulated={message.simulated} />
            </DialogTitle>
            <DialogDescription>
              To {message.recipientName ? `${message.recipientName} · ` : ""}
              {message.recipient}
              {message.providerMessageId ? <span className="block font-mono text-[11px] break-all">id {message.providerMessageId}</span> : null}
            </DialogDescription>
          </DialogHeader>
          <MessageDetails message={message} />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Message text, delivery steps and the simulated note. Shown in the dialog above and inline on the request page. */
export function MessageDetails({ message }: { message: MessageView }) {
  const steps = [
    { key: "queued", label: "Queued", at: message.queuedAt, icon: Clock, done: true },
    { key: "sent", label: "Sent", at: message.sentAt, icon: Send, done: !!message.sentAt },
    ...(message.status === "FAILED" || message.failedAt
      ? [{ key: "failed", label: "Failed", at: message.failedAt, icon: XCircle, done: true, failed: true }]
      : [
          { key: "delivered", label: "Delivered", at: message.deliveredAt, icon: Check, done: !!message.deliveredAt },
          { key: "read", label: message.channel === "EMAIL" ? "Opened" : "Read", at: message.readAt, icon: message.channel === "EMAIL" ? Eye : CheckCheck, done: !!message.readAt },
        ]),
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_200px]">
        <div className="space-y-2">
          {message.subject ? <p className="text-sm font-semibold">{message.subject}</p> : null}
          <div
            className={cn(
              "whitespace-pre-wrap rounded-lg border p-3 text-sm leading-relaxed",
              message.channel === "WHATSAPP" ? "bg-[#e7ffdb] border-[#cde9c0]" : "bg-muted/40",
            )}
          >
            {message.renderedBody}
          </div>
          {message.errorMessage ? (
            <p className="text-sm text-destructive">
              <span className="font-medium">Error {message.errorCode ? `(${message.errorCode})` : ""}:</span> {message.errorMessage}
            </p>
          ) : null}
        </div>
        <ol className="space-y-3">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.key} className="flex gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
                    s.done ? ("failed" in s && s.failed ? "bg-red-100 border-red-200 text-red-700" : "bg-emerald-100 border-emerald-200 text-emerald-700") : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <div>
                  <p className={cn("text-sm font-medium", !s.done && "text-muted-foreground")}>{s.label}</p>
                  <p className="text-xs text-muted-foreground">{fmt(s.at) ?? (s.done ? "" : "Not yet")}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      {message.simulated ? (
        <Badge variant="outline" className="w-fit text-muted-foreground">
          Simulated: no message left this machine (provider not configured or in simulate mode)
        </Badge>
      ) : null}
    </div>
  );
}
