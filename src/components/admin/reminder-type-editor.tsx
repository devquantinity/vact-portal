"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { AlertTriangle, Mail, MessageCircle, Plus, Send, X } from "lucide-react";
import { saveReminderTypeAction, sendTestMessageAction } from "@/actions/reminder-types";
import type { ActionState } from "@/lib/action-utils";
import { PLACEHOLDERS, findUnknownPlaceholders, renderTemplate, sampleVars } from "@/lib/templates/render";
import { composeTemplateMessage } from "@/lib/messaging/whatsapp";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, NativeSelect } from "@/components/forms/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { ActionFeedback } from "@/components/forms/action-feedback";

export type ReminderTypeValues = {
  id: string | null;
  name: string;
  description: string;
  channel: "WHATSAPP" | "EMAIL" | "BOTH";
  daysBefore: number[];
  repeatEveryDays: number | null;
  escalateAfter: number | null;
  whatsappBody: string;
  emailSubject: string;
  emailBody: string;
  active: boolean;
};

const SAMPLE = sampleVars();

export function ReminderTypeEditor({ initial, adminContact }: { initial: ReminderTypeValues; adminContact: { email: string; phone: string | null } }) {
  const [values, setValues] = useState(initial);
  const [dayInput, setDayInput] = useState("");
  const saveBound = saveReminderTypeAction.bind(null, initial.id);
  const [saveState, saveAction] = useActionState<ActionState, FormData>(saveBound, null);
  const [testState, testAction] = useActionState<ActionState<{ whatsapp?: string; email?: string }>, FormData>(sendTestMessageAction, null);
  const errors = (!saveState?.ok && saveState?.fieldErrors) || {};
  const lastFocused = useRef<"whatsappBody" | "emailSubject" | "emailBody">("whatsappBody");
  const waRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const set = <K extends keyof ReminderTypeValues>(key: K, value: ReminderTypeValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  function addDay(raw: string) {
    const n = Number(raw.trim());
    if (!Number.isInteger(n) || n < 0 || n > 365) return;
    set("daysBefore", [...new Set([...values.daysBefore, n])].sort((a, b) => b - a));
    setDayInput("");
  }

  function insertPlaceholder(key: string) {
    const field = lastFocused.current;
    const el = field === "whatsappBody" ? waRef.current : field === "emailSubject" ? subjectRef.current : bodyRef.current;
    const token = `{${key}}`;
    const current = values[field];
    if (!el) {
      set(field, `${current}${token}`);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    set(field, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const unknown = useMemo(
    () => ({
      whatsappBody: findUnknownPlaceholders(values.whatsappBody),
      emailSubject: findUnknownPlaceholders(values.emailSubject),
      emailBody: findUnknownPlaceholders(values.emailBody),
    }),
    [values.whatsappBody, values.emailSubject, values.emailBody],
  );

  const preview = useMemo(() => {
    const wa = renderTemplate(values.whatsappBody, SAMPLE).text;
    return {
      whatsapp: composeTemplateMessage({ clientName: SAMPLE.client_name, body: wa, link: SAMPLE.link }).text,
      subject: renderTemplate(values.emailSubject, SAMPLE).text,
      body: renderTemplate(values.emailBody, SAMPLE).text,
    };
  }, [values.whatsappBody, values.emailSubject, values.emailBody]);

  const schedule = describeSchedule(values);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <form action={saveAction} className="space-y-6">
        <input type="hidden" name="daysBefore" value={values.daysBefore.join(",")} />
        <input type="hidden" name="channel" value={values.channel} />
        <input type="hidden" name="whatsappBody" value={values.whatsappBody} />
        <input type="hidden" name="emailSubject" value={values.emailSubject} />
        <input type="hidden" name="emailBody" value={values.emailBody} />
        <input type="hidden" name="active" value={values.active ? "true" : "false"} />

        <Card>
          <CardHeader>
            <CardTitle>Rule</CardTitle>
            <CardDescription>{schedule}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
              <Field label="Name" htmlFor="rt-name" error={errors.name}>
                <Input id="rt-name" name="name" value={values.name} onChange={(e) => set("name", e.target.value)} required />
              </Field>
              <Field label="Channel" htmlFor="rt-channel" error={errors.channel}>
                <NativeSelect id="rt-channel" value={values.channel} onChange={(e) => set("channel", e.target.value as ReminderTypeValues["channel"])}>
                  <option value="BOTH">WhatsApp + email</option>
                  <option value="WHATSAPP">WhatsApp only</option>
                  <option value="EMAIL">Email only</option>
                </NativeSelect>
              </Field>
            </div>
            <Field label="Description (internal)" htmlFor="rt-desc" error={errors.description}>
              <Input id="rt-desc" name="description" value={values.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field label="Days before due date" error={errors.daysBefore} hint="One reminder per value, sent at 09:00. Add a number and press Enter.">
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
                {values.daysBefore.map((d) => (
                  <Badge key={d} variant="secondary" className="gap-1 pr-1">
                    {d === 0 ? "On due date" : `${d} day${d === 1 ? "" : "s"} before`}
                    <button type="button" aria-label={`Remove ${d}`} className="rounded-full p-0.5 hover:bg-foreground/10" onClick={() => set("daysBefore", values.daysBefore.filter((x) => x !== d))}>
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    value={dayInput}
                    onChange={(e) => setDayInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addDay(dayInput);
                      }
                    }}
                    inputMode="numeric"
                    placeholder="e.g. 7"
                    className="h-7 w-20 text-xs"
                    aria-label="Add days before"
                  />
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => addDay(dayInput)} aria-label="Add">
                    <Plus />
                  </Button>
                </div>
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="After the due date, repeat every (days)" htmlFor="rt-repeat" error={errors.repeatEveryDays} hint="Leave empty to stop after the due date.">
                <Input
                  id="rt-repeat"
                  name="repeatEveryDays"
                  type="number"
                  min={1}
                  max={90}
                  value={values.repeatEveryDays ?? ""}
                  onChange={(e) => set("repeatEveryDays", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>
              <Field label="Escalate to staff after (reminders)" htmlFor="rt-escalate" error={errors.escalateAfter} hint="Leave empty for no escalation.">
                <Input
                  id="rt-escalate"
                  name="escalateAfter"
                  type="number"
                  min={1}
                  max={50}
                  value={values.escalateAfter ?? ""}
                  onChange={(e) => set("escalateAfter", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive rules stay attached to existing requests but cannot be picked for new ones.</p>
              </div>
              <Switch checked={values.active} onCheckedChange={(v) => set("active", v)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
            <CardDescription>Write in any language. Click a placeholder to insert it at the cursor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => insertPlaceholder(p.key)}
                  title={p.description}
                  className="rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs text-foreground hover:border-primary hover:text-primary cursor-pointer"
                >
                  {`{${p.key}}`}
                </button>
              ))}
            </div>
            <Field
              label={
                <span className="flex items-center gap-2">
                  <MessageCircle className="size-4 text-emerald-600" /> WhatsApp message
                </span>
              }
              htmlFor="rt-wa"
              error={errors.whatsappBody}
              hint="Sent inside the approved template: fixed greeting, your text, then the portal link."
            >
              <Textarea
                id="rt-wa"
                ref={waRef}
                rows={4}
                value={values.whatsappBody}
                onChange={(e) => set("whatsappBody", e.target.value)}
                onFocus={() => (lastFocused.current = "whatsappBody")}
                className={cn(values.channel === "EMAIL" && "opacity-60")}
              />
              <UnknownFlags keys={unknown.whatsappBody} />
            </Field>
            <Field
              label={
                <span className="flex items-center gap-2">
                  <Mail className="size-4 text-sky-600" /> Email subject
                </span>
              }
              htmlFor="rt-subject"
              error={errors.emailSubject}
            >
              <Input
                id="rt-subject"
                ref={subjectRef}
                value={values.emailSubject}
                onChange={(e) => set("emailSubject", e.target.value)}
                onFocus={() => (lastFocused.current = "emailSubject")}
                className={cn(values.channel === "WHATSAPP" && "opacity-60")}
              />
              <UnknownFlags keys={unknown.emailSubject} />
            </Field>
            <Field label="Email body" htmlFor="rt-email" error={errors.emailBody} hint="Blank lines start new paragraphs. The portal button and footer are added automatically.">
              <Textarea
                id="rt-email"
                ref={bodyRef}
                rows={9}
                value={values.emailBody}
                onChange={(e) => set("emailBody", e.target.value)}
                onFocus={() => (lastFocused.current = "emailBody")}
                className={cn(values.channel === "WHATSAPP" && "opacity-60")}
              />
              <UnknownFlags keys={unknown.emailBody} />
            </Field>
          </CardContent>
        </Card>

        <ActionFeedback state={saveState} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SubmitButton pendingText="Saving…">{initial.id ? "Save changes" : "Create reminder type"}</SubmitButton>
        </div>
      </form>

      <div className="space-y-6 xl:sticky xl:top-8 xl:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>Rendered with sample data for Hafiz Trading Sdn Bhd.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={values.channel === "EMAIL" ? "email" : "whatsapp"}>
              <TabsList className="mb-3">
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
              </TabsList>
              <TabsContent value="whatsapp">
                <div className="rounded-xl bg-[#efeae2] p-4">
                  <div className="relative ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[#e7ffdb] px-3 py-2 text-[13px] leading-relaxed shadow-sm whitespace-pre-wrap break-words">
                    {preview.whatsapp}
                    <span className="mt-1 block text-right text-[10px] text-muted-foreground">09:00 ✓✓</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{preview.whatsapp.length} / 1,024 characters</p>
              </TabsContent>
              <TabsContent value="email">
                <div className="overflow-hidden rounded-xl border">
                  <div className="bg-navy px-4 py-3 text-xs font-semibold text-white">V ACT Client Portal</div>
                  <div className="space-y-3 bg-white px-4 py-4 text-sm">
                    <p className="font-semibold text-foreground">{preview.subject || <span className="text-muted-foreground">(no subject)</span>}</p>
                    {preview.body
                      .split(/\n{2,}/)
                      .filter(Boolean)
                      .map((para, i) => (
                        <p key={i} className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#1f2a44]">
                          {para}
                        </p>
                      ))}
                    <span className="inline-block rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white">Upload now</span>
                  </div>
                  <div className="border-t bg-muted/30 px-4 py-2 text-[10px] text-muted-foreground">V ACT Management Services Sdn. Bhd. · +603-2011 8002</div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Send a test</CardTitle>
            <CardDescription>
              Sends the current text with sample data to you: {adminContact.email}
              {adminContact.phone ? ` and ${adminContact.phone}` : " (no phone on your account)"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={testAction} className="space-y-3">
              <input type="hidden" name="channel" value={values.channel} />
              <input type="hidden" name="whatsappBody" value={values.whatsappBody} />
              <input type="hidden" name="emailSubject" value={values.emailSubject} />
              <input type="hidden" name="emailBody" value={values.emailBody} />
              <ActionFeedback state={testState} />
              <SubmitButton variant="outline" pendingText="Sending…">
                <Send /> Send test message
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UnknownFlags({ keys }: { keys: string[] }) {
  if (keys.length === 0) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs text-amber-700">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Unknown placeholder{keys.length > 1 ? "s" : ""} {keys.map((k) => `{${k}}`).join(", ")} will be sent as-is.
      </span>
    </p>
  );
}

export function describeSchedule(v: Pick<ReminderTypeValues, "daysBefore" | "repeatEveryDays" | "escalateAfter" | "channel">): string {
  const channel = v.channel === "BOTH" ? "WhatsApp and email" : v.channel === "WHATSAPP" ? "WhatsApp" : "Email";
  const before = v.daysBefore.length
    ? `${v.daysBefore.map((d) => (d === 0 ? "on the due date" : `${d} day${d === 1 ? "" : "s"} before`)).join(", ")}`
    : "no reminders before the due date";
  const repeat = v.repeatEveryDays ? `, then every ${v.repeatEveryDays} day${v.repeatEveryDays === 1 ? "" : "s"} after the due date until uploaded` : ", nothing after the due date";
  const escalate = v.escalateAfter ? `. Staff are alerted after ${v.escalateAfter} reminder${v.escalateAfter === 1 ? "" : "s"} with no upload.` : ". No escalation.";
  return `${channel}: ${before}${repeat}${escalate}`;
}
