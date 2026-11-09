import Link from "next/link";
import { cn } from "@/lib/utils";

export function LinkTabs({
  tabs,
  current,
  hrefFor,
}: {
  tabs: { key: string; label: string; count?: number }[];
  current: string;
  hrefFor: (key: string) => string;
}) {
  return (
    <div className="mb-5 overflow-x-auto">
      <nav className="flex min-w-max gap-1 border-b">
        {tabs.map((t) => {
          const active = t.key === current;
          return (
            <Link
              key={t.key}
              href={hrefFor(t.key)}
              scroll={false}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              {t.label}
              {t.count != null ? (
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                  {t.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
