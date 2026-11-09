"use client";

import { useActionState } from "react";
import { changePasswordAction, type FormState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/shared/submit-button";
import { FormMessage } from "@/components/auth/form-message";

export function ChangePasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Current password" htmlFor="current">
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="password" hint="At least 8 characters with a letter and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">Change password</SubmitButton>
    </form>
  );
}
