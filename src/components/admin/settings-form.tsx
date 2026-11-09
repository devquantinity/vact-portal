"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "@/actions/settings";
import type { ActionState } from "@/lib/action-utils";
import type { AppSettings } from "@/lib/settings";
import { Input } from "@/components/ui/input";
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
      <Field label="Office phone shown to clients" htmlFor="staffPhone" error={errors.staffPhone} hint="Used for {staff_phone} when the assigned officer has no number.">
        <Input id="staffPhone" name="staffPhone" defaultValue={settings.staffPhone} required />
      </Field>
      <ActionFeedback state={state} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}
