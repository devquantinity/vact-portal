"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "@/actions/settings";
import type { ActionState } from "@/lib/action-utils";
import type { AppSettings } from "@/lib/settings";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { ActionFeedback } from "@/components/forms/action-feedback";

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, action] = useActionState<ActionState, FormData>(saveSettingsAction, null);
  const errors = (!state?.ok && state?.fieldErrors) || {};
  return (
    <form action={action} className="space-y-5">
      <Field label="Portal name" htmlFor="brandName" error={errors.brandName} hint="Shown in the header, emails and WhatsApp messages.">
        <Input id="brandName" name="brandName" defaultValue={settings.brandName} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Send window starts" htmlFor="sendWindowStart" error={errors.sendWindowStart} hint="Kuala Lumpur time">
          <Input id="sendWindowStart" name="sendWindowStart" type="time" defaultValue={settings.sendWindowStart} required />
        </Field>
        <Field label="Send window ends" htmlFor="sendWindowEnd" error={errors.sendWindowEnd}>
          <Input id="sendWindowEnd" name="sendWindowEnd" type="time" defaultValue={settings.sendWindowEnd} required />
        </Field>
      </div>
      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <div>
          <p className="text-sm font-medium">Skip weekends</p>
          <p className="text-xs text-muted-foreground">Reminders due on Saturday or Sunday move to Monday at the window start.</p>
        </div>
        <Switch name="skipWeekends" defaultChecked={settings.skipWeekends} />
      </div>
      <div className="space-y-3 rounded-md border px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Skip public holidays</p>
            <p className="text-xs text-muted-foreground">Reminders due on a holiday below move to the next working day.</p>
          </div>
          <Switch name="skipPublicHolidays" defaultChecked={settings.skipPublicHolidays} />
        </div>
        <Field
          label="Public holidays (Kuala Lumpur)"
          htmlFor="publicHolidays"
          error={errors.publicHolidays}
          hint="One per line: date then name, e.g. 2027-03-10 Hari Raya Aidilfitri. Islamic dates depend on moon sighting; correct them here when announced."
        >
          <Textarea id="publicHolidays" name="publicHolidays" defaultValue={settings.publicHolidays} rows={8} className="font-mono text-xs" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Office phone shown to clients" htmlFor="staffPhone" error={errors.staffPhone} hint="The call button, and {staff_phone} in messages.">
          <Input id="staffPhone" name="staffPhone" defaultValue={settings.staffPhone} required />
        </Field>
        <Field label="WhatsApp number shown to clients" htmlFor="officeWhatsapp" error={errors.officeWhatsapp} hint="The WhatsApp button on the client's page.">
          <Input id="officeWhatsapp" name="officeWhatsapp" defaultValue={settings.officeWhatsapp} required />
        </Field>
      </div>
      <ActionFeedback state={state} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}
