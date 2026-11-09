import { cn } from "@/lib/utils";

/** The V ACT logo on a white tile, so it reads on navy and on light surfaces alike. */
export function Logo({ className, imgClassName }: { className?: string; imgClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md bg-white px-2 py-1.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="V ACT" className={cn("h-6 w-auto", imgClassName)} />
    </span>
  );
}
