"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { acknowledgeEscalationAction } from "@/actions/requests";
import { Button } from "@/components/ui/button";

export function AcknowledgeEscalationButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await acknowledgeEscalationAction(id);
          if (res?.ok) toast.success(res.message);
          else if (res) toast.error(res.error);
        })
      }
    >
      <Check /> Acknowledge
    </Button>
  );
}
