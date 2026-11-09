"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/forms/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { ActionFeedback } from "@/components/forms/action-feedback";

export type StaffOption = { id: string; name: string };

export type CompanyFormValues = {
  name: string;
  ssmNumber: string;
  incorporationDate: string; // yyyy-MM-dd or ""
  fyeMonth: string;
  fyeDay: string;
  assignedStaffId: string;
  status: "ACTIVE" | "INACTIVE";
  notes: string;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function CompanyForm({
  action,
  staff,
  defaults,
  submitLabel,
  onSuccess,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  staff: StaffOption[];
  defaults?: Partial<CompanyFormValues>;
  submitLabel: string;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  const errors = (!state?.ok && state?.fieldErrors) || {};
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Company name" htmlFor="name" error={errors.name}>
        <Input id="name" name="name" defaultValue={defaults?.name ?? ""} placeholder="e.g. Hafiz Trading Sdn Bhd" required />
      </Field>
      <Field label="SSM registration number" htmlFor="ssmNumber" error={errors.ssmNumber} hint="New 12-digit number, old number in brackets, e.g. 202301012345 (1512345-X)">
        <Input id="ssmNumber" name="ssmNumber" defaultValue={defaults?.ssmNumber ?? ""} placeholder="202301012345 (1512345-X)" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Incorporation date" htmlFor="incorporationDate" error={errors.incorporationDate}>
          <Input id="incorporationDate" name="incorporationDate" type="date" defaultValue={defaults?.incorporationDate ?? ""} />
        </Field>
        <Field label="Financial year end" error={errors.fyeMonth ?? errors.fyeDay}>
          <div className="grid grid-cols-2 gap-2">
            <NativeSelect name="fyeDay" defaultValue={defaults?.fyeDay ?? ""} aria-label="Day">
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect name="fyeMonth" defaultValue={defaults?.fyeMonth ?? ""} aria-label="Month">
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </NativeSelect>
          </div>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assigned staff" htmlFor="assignedStaffId" error={errors.assignedStaffId}>
          <NativeSelect id="assignedStaffId" name="assignedStaffId" defaultValue={defaults?.assignedStaffId ?? ""}>
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Status" htmlFor="status" error={errors.status}>
          <NativeSelect id="status" name="status" defaultValue={defaults?.status ?? "ACTIVE"}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Notes" htmlFor="notes" error={errors.notes} hint="Internal only, never shown to the client.">
        <Textarea id="notes" name="notes" defaultValue={defaults?.notes ?? ""} rows={3} />
      </Field>
      <ActionFeedback state={state} onSuccess={onSuccess} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
