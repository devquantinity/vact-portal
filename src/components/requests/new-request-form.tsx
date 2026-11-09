"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarClock, Info } from "lucide-react";
import { createRequestAction } from "@/actions/requests";
import type { ActionState } from "@/lib/action-utils";
import { describeSchedule, generateSchedule } from "@/lib/reminders/schedule";
import { formatDateTime, todayMyt } from "@/lib/dates";
import { CHANNEL_LABEL } from "@/lib/status";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, NativeSelect } from "@/components/forms/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { ActionFeedback } from "@/components/forms/action-feedback";

export type CompanyOption = { id: string; name: string; assignedStaff: string | null; contacts: number };
export type DocumentTypeOption = { id: string; name: string; description: string | null; acceptedExtensions: string[]; maxSizeMb: number };
export type ReminderTypeOption = {
  id: string;
  name: string;
  channel: "WHATSAPP" | "EMAIL" | "BOTH";
  daysBefore: number[];
  repeatEveryDays: number | null;
  escalateAfter: number | null;
};

export function NewRequestForm({
  companies,
  documentTypes,
  reminderTypes,
  initialCompanyId,
}: {
  companies: CompanyOption[];
  documentTypes: DocumentTypeOption[];
  reminderTypes: ReminderTypeOption[];
  initialCompanyId?: string;
}) {
  const [state, action] = useActionState<ActionState<{ requestId: string }>, FormData>(createRequestAction, null);
  const errors = (!state?.ok && state?.fieldErrors) || {};
  const [companyId, setCompanyId] = useState(initialCompanyId ?? companies[0]?.id ?? "");
  const [documentTypeId, setDocumentTypeId] = useState(documentTypes[0]?.id ?? "");
  const [reminderTypeId, setReminderTypeId] = useState(reminderTypes[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const minDate = todayMyt();

  const company = companies.find((c) => c.id === companyId);
  const documentType = documentTypes.find((d) => d.id === documentTypeId);
  const rule = reminderTypes.find((r) => r.id === reminderTypeId);

  const schedule = useMemo(() => {
    if (!rule || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
    const now = new Date();
    return { text: describeSchedule(rule, dueDate, now), jobs: generateSchedule(rule, dueDate, now) };
  }, [rule, dueDate]);

  const uniqueMoments = schedule ? [...new Map(schedule.jobs.map((j) => [`${j.scheduledFor.getTime()}-${j.kind}`, j])).values()] : [];

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Request details</CardTitle>
          <CardDescription>The client is notified immediately on the rule&apos;s channels, then reminded on the schedule shown.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Company" htmlFor="companyId" error={errors.companyId} hint={company ? `${company.contacts} contact${company.contacts === 1 ? "" : "s"} will be notified · officer: ${company.assignedStaff ?? "unassigned"}` : undefined}>
            <NativeSelect id="companyId" name="companyId" value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
              <option value="" disabled>
                Choose a company…
              </option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Document type" htmlFor="documentTypeId" error={errors.documentTypeId} hint={documentType ? `${documentType.acceptedExtensions.map((e) => `.${e}`).join(", ")} · up to ${documentType.maxSizeMb} MB` : undefined}>
            <NativeSelect id="documentTypeId" name="documentTypeId" value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} required>
              {documentTypes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reminder rule" htmlFor="reminderTypeId" error={errors.reminderTypeId}>
              <NativeSelect id="reminderTypeId" name="reminderTypeId" value={reminderTypeId} onChange={(e) => setReminderTypeId(e.target.value)} required>
                {reminderTypes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Due date" htmlFor="dueDate" error={errors.dueDate}>
              <Input id="dueDate" name="dueDate" type="date" min={minDate} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </Field>
          </div>
          <Field label="Instructions for the client (optional)" htmlFor="instructions" error={errors.instructions} hint="Shown on the client's request page and in the first email.">
            <Textarea id="instructions" name="instructions" rows={3} placeholder="e.g. Please include all 12 monthly statements for FY2025 in one PDF." />
          </Field>
          <ActionFeedback state={state} />
          <div className="flex justify-end">
            <SubmitButton pendingText="Creating and notifying…" disabled={!schedule}>
              Confirm and notify client
            </SubmitButton>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" /> Reminder schedule
            </CardTitle>
            <CardDescription>{rule ? `${CHANNEL_LABEL[rule.channel]} · ${rule.name}` : "Pick a rule"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!schedule ? (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" /> Choose a due date to see when reminders will go out.
              </p>
            ) : (
              <>
                <p className="text-sm">{schedule.text}</p>
                <ol className="space-y-1.5">
                  <li className="flex items-center gap-2 text-sm">
                    <Badge variant="info">Now</Badge> New request notification
                  </li>
                  {uniqueMoments.map((j) => (
                    <li key={`${j.scheduledFor.toISOString()}-${j.kind}`} className="flex items-center gap-2 text-sm">
                      <Badge variant={j.kind === "REPEAT" ? "changes" : "pending"}>{j.kind === "REPEAT" ? "Repeat" : `${Math.abs(j.dayOffset)}d before`}</Badge>
                      {formatDateTime(j.scheduledFor, "EEE d MMM yyyy, HH:mm")}
                      {j.kind === "REPEAT" && rule?.repeatEveryDays ? <span className="text-muted-foreground">then every {rule.repeatEveryDays} days</span> : null}
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-muted-foreground">All reminders stop automatically when the client uploads. Times are Kuala Lumpur.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
