"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteReminderTypeAction } from "@/actions/reminder-types";
import { Button } from "@/components/ui/button";

export function DeleteReminderTypeButton({ id, disabled }: { id: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={disabled || pending}
      title={disabled ? "In use by requests; deactivate it instead" : "Delete"}
      onClick={() =>
        start(async () => {
          const res = await deleteReminderTypeAction(id);
          if (res && !res.ok) toast.error(res.error);
        })
      }
    >
      <Trash2 /> Delete
    </Button>
  );
}
