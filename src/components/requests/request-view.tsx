"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, CheckCircle2, ChevronDown, Clock, MessageSquareWarning, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { acknowledgeEscalationAction, cancelRequestAction, reviewRequestAction } from "@/actions/requests";
import type { ActionState } from "@/lib/action-utils";
import type { JobView, RequestDetail } from "@/lib/requests/detail";
import { CHANNEL_LABEL, MESSAGE_KIND_LABEL } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { DetailList } from "@/components/shared/detail-list";
import { MessageStatusBadge } from "@/components/shared/status-badge";
import { MessageDetails } from "@/components/messages/message-timeline";
import { DocumentPreview } from "./document-preview";
import { FileUploader } from "./file-uploader";

/**
 * Everything about one request on a single page, top to bottom: what happens next, the files (and the review
 * decision), reminders, messages and details. No tabs, no dialogs. Used on the request page and in the review queue.
 * After a review decision it goes to `afterReviewHref`, or stays and refreshes when that is not given.
 */
export function RequestView({ request, afterReviewHref }: { request: RequestDetail; afterReviewHref?: string }) {
  const router = useRouter();
  const awaiting = request.documents.filter((d) => d.reviewStatus === "AWAITING");
  const canReview = request.status === "UPLOADED" && awaiting.length > 0;
  const canUpload = request.status === "PENDING" || request.status === "CHANGES_REQUESTED" || request.status === "UPLOADED";
  const canCancel = request.status !== "APPROVED" && request.status !== "CANCELLED";
  const moments = groupReminders(request.jobs);

  function afterReview() {
    if (afterReviewHref) router.push(afterReviewHref, { scroll: false });
    else router.refresh();
  }

  return (
    <div className="space-y-10">
      <NextStep request={request} moments={moments} awaitingCount={awaiting.length} />

      {request.escalations.some((e) => !e.acknowledgedAt) ? <Escalations request={request} /> : null}

      <Section
        title="Files"
        description={request.documents.length ? "Newest first. Click a file to preview it." : undefined}
      >
        {request.documents.length ? (
          <DocumentPreview documents={request.documents} />
        ) : (
          <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
        )}
        {canReview ? <ReviewForm requestId={request.id} awaitingCount={awaiting.length} onDone={afterReview} /> : null}
        {canUpload ? <UploadForClient request={request} /> : null}
      </Section>

      <Section title="Reminders" description={`Rule: ${request.reminderType.name} (${CHANNEL_LABEL[request.reminderType.channel]}).`}>
        {moments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reminders on this request.</p>
        ) : (
          <ol className="divide-y rounded-lg border bg-card">
            {moments.map((m) => (
              <li key={m.when} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{m.when}</span>
                  <span className="text-muted-foreground"> · {m.channels}</span>
                  {m.error ? <span className="block text-xs text-destructive">{m.error}</span> : null}
                </span>
                <ReminderState state={m.state} />
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Messages" description="What was sent to the client and staff about this request. Click one to read it.">
        {request.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {request.messages.map((m) => (
              <li key={m.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="font-medium">{CHANNEL_LABEL[m.channel]}</span> · {MESSAGE_KIND_LABEL[m.kind] ?? m.kind} to{" "}
                      {m.recipientName ?? m.recipient}
                      <span className="block text-xs text-muted-foreground">
                        {new Date(m.queuedAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <MessageStatusBadge status={m.status} simulated={m.simulated} />
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="border-t bg-muted/20 px-4 py-4">
                    <MessageDetails message={m} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Details">
        <DetailList
          items={[
            { label: "Client contacts", value: request.contacts.length ? request.contacts.map((c) => `${c.name} (${[c.phone, c.email].filter(Boolean).join(", ")})`).join("; ") : "No contacts on this company" },
            { label: "Instructions to client", value: request.instructions },
            { label: "Accepted files", value: `${request.documentType.acceptedExtensions.map((e) => `.${e}`).join(", ")} · up to ${request.documentType.maxSizeMb} MB` },
            { label: "Created", value: `${request.createdAt} by ${request.createdBy}` },
            ...(request.closedAt ? [{ label: "Closed", value: request.closedAt }] : []),
          ]}
        />
      </Section>

      {canCancel ? <CancelRequest requestId={request.id} /> : null}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

type Moment = { when: string; channels: string; state: "SENT" | "SCHEDULED" | "FAILED" | "SKIPPED" | "CANCELLED"; error: string | null };

/** One line per reminder moment (WhatsApp and email at the same time count as one reminder). */
function groupReminders(jobs: JobView[]): Moment[] {
  const byTime = new Map<string, JobView[]>();
  for (const j of jobs) byTime.set(j.scheduledFor, [...(byTime.get(j.scheduledFor) ?? []), j]);
  return [...byTime.entries()].map(([when, js]) => {
    const statuses = js.map((j) => j.status);
    const state = statuses.includes("SENT")
      ? "SENT"
      : statuses.includes("SCHEDULED")
        ? "SCHEDULED"
        : statuses.includes("FAILED")
          ? "FAILED"
          : statuses.includes("SKIPPED")
            ? "SKIPPED"
            : "CANCELLED";
    return {
      when,
      channels: js.map((j) => CHANNEL_LABEL[j.channel]).join(" + "),
      state,
      error: js.find((j) => j.lastError)?.lastError ?? null,
    };
  });
}

function ReminderState({ state }: { state: Moment["state"] }) {
  if (state === "SENT") return <Badge variant="approved">Sent</Badge>;
  if (state === "SCHEDULED") return <Badge variant="info">Planned</Badge>;
  if (state === "FAILED") return <Badge variant="overdue">Failed</Badge>;
  if (state === "SKIPPED") return <Badge variant="pending">Skipped</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Not needed</Badge>;
}

/** One plain sentence on where the request stands and what, if anything, staff should do. */
function NextStep({ request, moments, awaitingCount }: { request: RequestDetail; moments: Moment[]; awaitingCount: number }) {
  const client = request.contacts[0]?.name ?? "the client";
  const sent = moments.filter((m) => m.state === "SENT").length;
  const next = moments.find((m) => m.state === "SCHEDULED");
  const reminderLine = `${sent} reminder${sent === 1 ? "" : "s"} sent so far. ${next ? `Next one: ${next.when} by ${next.channels}.` : "No more reminders are planned."}`;

  let tone: "info" | "warn" | "danger" | "done" | "muted" = "info";
  let Icon = Clock;
  let title = "";
  let body = "";
  switch (request.status) {
    case "PENDING":
      tone = request.overdue ? "danger" : "info";
      Icon = request.overdue ? AlertTriangle : Clock;
      title = request.overdue ? "Overdue: still waiting for the client" : `Waiting for ${client} to upload`;
      body = reminderLine;
      break;
    case "UPLOADED":
      tone = "warn";
      Icon = CheckCircle2;
      title = `${awaitingCount} file${awaitingCount === 1 ? "" : "s"} ready for your review`;
      body = "Look at the file below, then approve it or ask for changes. Reminders have stopped.";
      break;
    case "CHANGES_REQUESTED":
      tone = "warn";
      Icon = MessageSquareWarning;
      title = `Waiting for ${client} to send a corrected file`;
      body = "You asked for changes. The client has been told what to fix.";
      break;
    case "APPROVED":
      tone = "done";
      Icon = CheckCircle2;
      title = "Approved. Nothing more to do.";
      body = request.closedAt ? `Closed ${request.closedAt}.` : "";
      break;
    case "CANCELLED":
      tone = "muted";
      Icon = XCircle;
      title = "Cancelled";
      body = `${request.closedAt ? `Cancelled ${request.closedAt}. ` : ""}No more reminders will be sent.`;
      break;
  }
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-5 py-4",
        tone === "info" && "border-sky-200 bg-sky-50 text-sky-950",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-950",
        tone === "danger" && "border-red-200 bg-red-50 text-red-950",
        tone === "done" && "border-emerald-200 bg-emerald-50 text-emerald-950",
        tone === "muted" && "border-border bg-muted/40",
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-0.5">
        <p className="font-semibold">{title}</p>
        {body ? <p className="text-sm opacity-90">{body}</p> : null}
      </div>
    </div>
  );
}

function Escalations({ request }: { request: RequestDetail }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {request.escalations
        .filter((e) => !e.acknowledgedAt)
        .map((e) => (
          <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" /> Escalated: {e.remindersSent} reminders sent with no upload. {e.notifiedUser} was told {e.createdAt}.
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await acknowledgeEscalationAction(e.id);
                  if (res?.ok) {
                    toast.success(res.message);
                    router.refresh();
                  } else if (res) toast.error(res.error);
                })
              }
            >
              Mark as handled
            </Button>
          </div>
        ))}
    </div>
  );
}

function UploadForClient({ request }: { request: RequestDetail }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload /> Upload a file for the client
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="text-sm font-semibold">Upload a file for the client</p>
      <p className="text-sm text-muted-foreground">For files the client sent by email or WhatsApp. Reminders stop, the same as when the client uploads.</p>
      <FileUploader
        requestId={request.id}
        acceptedExtensions={request.documentType.acceptedExtensions}
        maxSizeMb={request.documentType.maxSizeMb}
        multiple={request.documentType.allowMultipleFiles}
        compact
        successMessage="Uploaded for the client. Reminders stopped; you can approve it now."
      />
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Close
      </Button>
    </div>
  );
}

function ReviewForm({ requestId, awaitingCount, onDone }: { requestId: string; awaitingCount: number; onDone: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const res = await reviewRequestAction(prev, formData);
    // Toast here, before the page re-renders without this form.
    if (res?.ok) {
      toast.success(res.message);
      onDone();
    } else if (res) {
      toast.error(res.error);
    }
    return res;
  }, null);
  const [decision, setDecision] = useState<"APPROVED" | "CHANGES_REQUESTED">("APPROVED");
  const errors = (!state?.ok && state?.fieldErrors) || {};
  return (
    <form action={action} className="space-y-4 rounded-xl border-2 border-primary/30 bg-card p-5">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="decision" value={decision} />
      <p className="font-semibold">
        Your decision on {awaitingCount === 1 ? "this file" : `these ${awaitingCount} files`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={decision === "APPROVED" ? "success" : "outline"} onClick={() => setDecision("APPROVED")}>
          <CheckCircle2 /> Approve
        </Button>
        <Button type="button" variant={decision === "CHANGES_REQUESTED" ? "destructive" : "outline"} onClick={() => setDecision("CHANGES_REQUESTED")}>
          <MessageSquareWarning /> Ask for changes
        </Button>
      </div>
      <Field
        label={decision === "CHANGES_REQUESTED" ? "What needs to change (the client sees this)" : "Note (optional, kept with the file)"}
        htmlFor="comment"
        error={errors.comment}
      >
        <Textarea
          id="comment"
          name="comment"
          rows={3}
          required={decision === "CHANGES_REQUESTED"}
          placeholder={decision === "CHANGES_REQUESTED" ? "e.g. Page 2 is missing and the signature is not visible." : ""}
        />
      </Field>
      {state && !state.ok ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <SubmitButton variant={decision === "APPROVED" ? "success" : "destructive"} pendingText="Saving…">
        {decision === "APPROVED" ? "Approve and tell the client" : "Send to the client"}
      </SubmitButton>
    </form>
  );
}

function CancelRequest({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  if (!confirming) {
    return (
      <div className="border-t pt-6">
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
          <Ban /> Cancel this request
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-destructive/30 bg-red-50 p-4">
      <p className="text-sm font-medium text-destructive">Cancel this request? Reminders stop and the client no longer sees it as outstanding.</p>
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason (optional, kept in the audit log)" />
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await cancelRequestAction(requestId, reason || null);
              if (res?.ok) {
                toast.success(res.message);
                router.refresh();
              } else if (res) toast.error(res.error);
            })
          }
        >
          Yes, cancel request
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
