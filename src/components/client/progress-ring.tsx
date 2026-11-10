import { cn } from "@/lib/utils";

/** Donut showing approved share, with the counts in the middle. */
export function ProgressRing({
  approved,
  total,
  size = 112,
  stroke = 10,
  className,
}: {
  approved: number;
  total: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const pct = total ? approved / total : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="img" aria-label={`${approved} of ${total} documents approved`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--success)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold leading-none tabular-nums">{Math.round(pct * 100)}%</span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">approved</span>
      </div>
    </div>
  );
}
