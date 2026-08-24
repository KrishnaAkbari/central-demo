import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        // Status variants — soft tinted backgrounds, dark text. These are
        // the ones missing in V-pass: code passes variant="success"/"info"/
        // "warning"/"indigo"/"error" but the old component only had 4
        // variants, so audit log badges and role system badges all rendered
        // identical (and silent fallback for unrecognised variants). The
        // soft-tint style matches the rest of the panel: status color as
        // a 10-15% tinted bg with a 600-weight foreground, readable in
        // both light and dark modes.
        success:
          "border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25",
        warning:
          "border-transparent bg-amber-50 text-amber-700 hover:bg-amber-100/80 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25",
        info:
          "border-transparent bg-sky-50 text-sky-700 hover:bg-sky-100/80 dark:bg-sky-500/15 dark:text-sky-300 dark:hover:bg-sky-500/25",
        indigo:
          "border-transparent bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25",
        error:
          "border-transparent bg-red-50 text-red-700 hover:bg-red-100/80 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
