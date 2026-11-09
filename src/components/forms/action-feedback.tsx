"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-utils";
import { FormMessage } from "@/components/auth/form-message";

/** Shows a toast when a server action result arrives; optionally renders an inline message too. */
export function ActionFeedback({ state, inline = true, onSuccess }: { state: ActionState<unknown>; inline?: boolean; onSuccess?: () => void }) {
  const last = useRef<ActionState<unknown>>(null);
  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      onSuccess?.();
    } else {
      toast.error(state.error);
    }
  }, [state, onSuccess]);
  if (!inline || !state) return null;
  if (state.ok && !state.message) return null;
  return <FormMessage state={state.ok ? { success: state.message } : { error: state.error }} />;
}
