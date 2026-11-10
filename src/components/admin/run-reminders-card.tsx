"use client";

import { useState, useTransition } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TickSummary = { sent: number; skipped: number; failed: number; deferred: number; processed: number; simulatedAdvanced?: number };

export function RunRemindersCard({
  lastTick,
  workerAlive,
  intervalMinutes,
  hosted,
}: {
  lastTick: string | null;
  workerAlive: boolean;
  /** Minutes between scheduler ticks (1 for the worker, 15 for a Vercel schedule on Hobby). */
  intervalMinutes: number;
  /** True on Vercel, where a schedule calls the tick route instead of the worker process. */
  hosted: boolean;
}) {
  const [pending, start] = useTransition();
  const [last, setLast] = useState<TickSummary | null>(null);
  const router = useRouter();
  const every = intervalMinutes === 1 ? "every minute" : `every ${intervalMinutes} minutes`;
  const runner = hosted ? "A Vercel schedule" : "The worker";

  function run() {
    start(async () => {
      try {
        const res = await fetch("/api/cron/tick", { method: "POST" });
        const json = (await res.json()) as TickSummary & { error?: string };
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setLast(json);
        toast.success(`Reminders run: ${json.sent} sent, ${json.skipped} skipped, ${json.failed} failed${json.deferred ? `, ${json.deferred} held for the send window` : ""}.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not run the scheduler");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Reminder scheduler
          <Badge variant={workerAlive ? "approved" : "overdue"}>{workerAlive ? "Scheduler running" : "Scheduler not seen"}</Badge>
        </CardTitle>
        <CardDescription>
          {runner} runs the scheduler {every}
          {lastTick ? ` (last run ${lastTick})` : ""}. Run it now to send anything that is due without waiting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={run} disabled={pending}>
          <Play /> {pending ? "Running…" : "Run reminders now"}
        </Button>
        {last ? (
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <Stat label="Sent" value={last.sent} tone="text-emerald-700" />
            <Stat label="Skipped" value={last.skipped} tone="text-muted-foreground" />
            <Stat label="Failed" value={last.failed} tone={last.failed ? "text-red-700" : "text-muted-foreground"} />
            <Stat label="Held" value={last.deferred} tone="text-amber-700" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border px-2 py-2">
      <p className={`font-display text-xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
