import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-white",
        outline: "text-foreground",
        // Status chips (spec: Pending grey, Overdue red, Awaiting review amber,
        // Changes requested orange, Approved green)
        pending: "border-transparent bg-slate-100 text-slate-700",
        overdue: "border-transparent bg-red-100 text-red-700",
        uploaded: "border-transparent bg-amber-100 text-amber-800",
        changes: "border-transparent bg-orange-100 text-orange-800",
        approved: "border-transparent bg-emerald-100 text-emerald-800",
        cancelled: "border-transparent bg-slate-100 text-slate-500 line-through",
        info: "border-transparent bg-sky-100 text-sky-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
