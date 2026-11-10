"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, CheckCircle2, MessageSquareWarning, Upload } from "lucide-react";
import { toast } from "sonner";
import { acknowledgeEscalationAction, cancelRequestAction, reviewRequestAction } from "@/actions/requests";
import type { ActionState } from "@/lib/action-utils";
import type { RequestDetail } from "@/lib/requests/detail";
import { describeDaysLeft } from "@/lib/dates";
import { CHANNEL_LABEL, JOB_STATUS_LABEL, MESSAGE_KIND_LABEL } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { DetailList } from "@/components/shared/detail-list";
import { EmptyState } from "@/components/shared/empty-state";
import { MessageStatusBadge, RequestStatusBadge } from "@/components/shared/status-badge";
import { MessageTimeline } from "@/components/messages/message-timeline";
import { DocumentPreview } from "./document-preview";
import { FileUploader } from "./file-uploader";

/** The request in a dialog, opened from a company page. */
export function RequestPanel({ request, closeHref }: { request: RequestDetail; closeHref: string }) {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={(o) => !o && router.push(closeHref, { scroll: false })}>
      <DialogContent className="sm:max-w-5xl p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
            {request.documentType.name}
            <RequestStatusBadge status={request.status} overdue={request.overdue} />
          </DialogTitle>
          <DialogDescription>
            {request.company.name} · due {request.dueDateLabel} ({describeDaysLeft(request.daysLeft)}) · officer {request.company.assignedStaff ?? "unassigned"}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-5">
          <RequestTabs request={request} afterReviewHref={closeHref} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Overview, files (with the review form), reminders and messages for one request. Used inside the dialog and
 * inline on the review queue. After a decision it goes to `afterReviewHref`.
 */
export function RequestTabs({ request, afterReviewHref }: { request: RequestDetail; afterReviewHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const awaiting = request.documents.filter((d) => d.reviewStatus === "AWAITING");
  const canReview = request.status === "UPLOADED" && awaiting.length > 0;
  const canUpload = request.status === "PENDING" || request.status === "CHANGES_REQUESTED" || request.status === "UPLOADED";
  const canCancel = request.status !== "APPROVED" && request.status !== "CANCELLED";

  return (
    <Tabs defaultValue={canReview ? "files" : request.documents.length ? "files" : "overview"}>
      <TabsList className="mb-4 flex-wrap h-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="files">Files {request.documents.length ? `(${request.documents.length})` : ""}</TabsTrigger>
        <TabsTrigger value="reminders">Reminders ({request.jobs.length})</TabsTrigger>
        <TabsTrigger value="messages">Messages ({request.messages.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-5">
        <DetailList
          items={[
            { label: "Reminder rule", value: `${request.reminderType.name} (${CHANNEL_LABEL[request.reminderType.channel]})` },
            { label: "Created", value: `${request.createdAt} by ${request.createdBy}` },
            { label: "Closed", value: request.closedAt },
            { label: "Accepted files", value: `${request.documentType.acceptedExtensions.map((e) => `.${e}`).join(", ")} · up to ${request.documentType.maxSizeMb} MB` },
            { label: "Contacts notified", value: request.contacts.length ? request.contacts.map((c) => `${c.name} (${[c.phone, c.email].filter(Boolean).join(", ")})`).join("; ") : "No contacts on this company" },
            { label: "Instructions to client", value: request.instructions },
          ]}
        />
        {request.escalations.length ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Escalations</h4>
            {request.escalations.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-700" /> {e.remindersSent} reminders with no upload · {e.notifiedUser} notified {e.createdAt}
                </span>
                {e.acknowledgedAt ? (
                  <Badge variant="approved">Acknowledged {e.acknowledgedAt}</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const res = await acknowledgeEscalationAction(e.id);
                        if (res?.ok) toast.success(res.message);
                        else if (res) toast.error(res.error);
                      })
                    }
                  >
                    Acknowledge
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : null}
        {canCancel ? <CancelRequest requestId={request.id} /> : null}
      </TabsContent>

      <TabsContent value="files" className="space-y-6">
        {request.documents.length === 0 ? (
          <EmptyState compact title="Nothing uploaded yet" description={request.status === "PENDING" ? "The client has not uploaded anything. You can upload on their behalf below." : "No files on this request."} />
        ) : (
          <DocumentPreview documents={request.documents} />
        )}
        {canReview ? <ReviewForm requestId={request.id} awaitingCount={awaiting.length} onDone={() => router.push(afterReviewHref, { scroll: false })} /> : null}
        {request.status === "CHANGES_REQUESTED" ? (
          <p className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
            <MessageSquareWarning className="size-4" /> Waiting for the client to upload a corrected version.
          </p>
        ) : null}
        {canUpload ? (
          <div className="space-y-2 rounded-lg border p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <Upload className="size-4" /> Upload on the client&apos;s behalf
            </h4>
            <p className="text-xs text-muted-foreground">
              For files received by email or WhatsApp. Recorded as uploaded by staff; scheduled reminders stop exactly as they would for a client upload.
            </p>
            <FileUploader
              requestId={request.id}
              acceptedExtensions={request.documentType.acceptedExtensions}
              maxSizeMb={request.documentType.maxSizeMb}
              multiple={request.documentType.allowMultipleFiles}
              compact
              successMessage="Uploaded on the client's behalf. Reminders stopped; you can approve it above."
            />
          </div>
        ) : null}
      </TabsContent>

      <TabsContent value="reminders">
        {request.jobs.length === 0 ? (
          <EmptyState compact title="No reminder jobs" description="This request was created with every reminder date already in the past, or the rule has no reminders." />
        ) : (
          <ul className="divide-y rounded-lg border">
            {request.jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Badge variant={j.kind === "REPEAT" ? "changes" : "pending"}>{j.kind === "REPEAT" ? "Repeat" : "Before due"}</Badge>
                  {CHANNEL_LABEL[j.channel]} · {j.scheduledFor}
                </span>
                <span className="flex items-center gap-2">
                  {j.sentAt ? <span className="text-xs text-muted-foreground">sent {j.sentAt}</span> : null}
                  {j.lastError ? <span className="text-xs text-destructive">{j.lastError}</span> : null}
                  <Badge variant={j.status === "SENT" ? "approved" : j.status === "SCHEDULED" ? "info" : j.status === "FAILED" ? "overdue" : "pending"}>{JOB_STATUS_LABEL[j.status]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="messages">
        {request.messages.length === 0 ? (
          <EmptyState compact title="No messages yet" description="Messages about this request appear here with delivery status." />
        ) : (
          <ul className="divide-y rounded-lg border">
            {request.messages.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{CHANNEL_LABEL[m.channel]}</span> · {MESSAGE_KIND_LABEL[m.kind] ?? m.kind} to {m.recipientName ?? m.recipient}
                  <span className="block text-xs text-muted-foreground">{new Date(m.queuedAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })}</span>
                </span>
                <span className="flex items-center gap-2">
                  <MessageStatusBadge status={m.status} simulated={m.simulated} />
                  <MessageTimeline message={m} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

function ReviewForm({ requestId, awaitingCount, onDone }: { requestId: string; awaitingCount: number; onDone: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const res = await reviewRequestAction(prev, formData);
    // Toast here, before the panel re-renders without this form.
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
    <form action={action} className="space-y-3 rounded-lg border bg-card p-4">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="decision" value={decision} />
      <h4 className="text-sm font-semibold">
        Review {awaitingCount} file{awaitingCount === 1 ? "" : "s"}
      </h4>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={decision === "APPROVED" ? "success" : "outline"} onClick={() => setDecision("APPROVED")}>
          <CheckCircle2 /> Approve
        </Button>
        <Button type="button" variant={decision === "CHANGES_REQUESTED" ? "destructive" : "outline"} onClick={() => setDecision("CHANGES_REQUESTED")}>
          <MessageSquareWarning /> Request changes
        </Button>
      </div>
      <Field
        label={decision === "CHANGES_REQUESTED" ? "What needs to change (sent to the client)" : "Comment (optional, kept with the file)"}
        htmlFor="comment"
        error={errors.comment}
      >
        <Textarea id="comment" name="comment" rows={3} required={decision === "CHANGES_REQUESTED"} placeholder={decision === "CHANGES_REQUESTED" ? "e.g. Page 2 is missing and the signature is not visible." : ""} />
      </Field>
      {state && !state.ok ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div className="flex justify-end">
        <SubmitButton variant={decision === "APPROVED" ? "success" : "destructive"} pendingText="Saving…">
          {decision === "APPROVED" ? "Approve and notify client" : "Send change request"}
        </SubmitButton>
      </div>
    </form>
  );
}

function CancelRequest({ requestId }: { requestId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  if (!confirming) {
    return (
      <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
        <Ban /> Cancel this request
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-destructive/30 bg-red-50 p-3">
      <p className="text-sm font-medium text-destructive">Cancel this request? Scheduled reminders stop and the client will no longer see it as outstanding.</p>
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason (optional, kept in the audit log)" />
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await cancelRequestAction(requestId, reason || null);
              if (res?.ok) toast.success(res.message);
              else if (res) toast.error(res.error);
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
