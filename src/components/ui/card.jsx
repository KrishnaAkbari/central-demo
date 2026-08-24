import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Card primitive. Visual passes:
 *  - elevated: 1px inner highlight ring + soft outer shadow + subtle gradient bg
 *  - accent:   1px colored top rail via `accent` color prop (tone name from StatRow TONE_CLASSES)
 *  - interactive: hover lift + brighter border (used on server cards, role cards, etc.)
 */
const Card = React.forwardRef(({ className, elevated, accent, interactive, ...props }, ref) => {
  // Map tone names to a Tailwind top-border color so the accent rail works in both light + dark
  const accentClass = accent && {
    indigo: 'border-t-indigo-500 dark:border-t-indigo-400',
    emerald: 'border-t-emerald-500 dark:border-t-emerald-400',
    amber: 'border-t-amber-500 dark:border-t-amber-400',
    rose: 'border-t-rose-500 dark:border-t-rose-400',
    red: 'border-t-red-500 dark:border-t-red-400',
    sky: 'border-t-sky-500 dark:border-t-sky-400',
    violet: 'border-t-violet-500 dark:border-t-violet-400',
    slate: 'border-t-slate-500 dark:border-t-slate-400',
    teal: 'border-t-teal-500 dark:border-t-teal-400',
  }[accent]

  return (
    <div
      ref={ref}
      className={cn(
        // Base — flat surface in both modes. No gradient, no shadow. Hairline
        // border is the only separator between card and canvas, matching
        // 2026 shadcn-panel aesthetic (cal.com, midday, openstatus).
        "rounded-xl border bg-card text-card-foreground relative overflow-hidden",
        // Dark mode: explicit slate-900 so we don't depend on the bg-card
        // token which renders slightly too dark for chart-heavy cards.
        "dark:bg-slate-900 dark:border-slate-800/80",
        // Subtle elevation marker for elevated cards (no actual shadow)
        elevated && "ring-1 ring-inset ring-black/[0.02] dark:ring-white/[0.04]",
        // Interactive — hover lift + brighter border for clickable cards
        interactive && "transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer",
        // Accent rail — colored top border. Use `border-2` (sets all-side width, `border-*`
        // namespace) + `border-t-{color}` (top color only, `border-t-*` namespace) so twMerge
        // keeps both. Putting both in the `border-t-*` namespace (e.g. `border-t-2 border-t-emerald-500`)
//   would let twMerge drop the color because it sees them as conflicting.
        accent && cn("border-2", accentClass, "border-x border-b border-slate-200 dark:border-slate-800"),
        !accent && "border-slate-200 dark:border-slate-800",
        className
      )}
      {...props}
    />
  )
})
Card.displayName = "Card"

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-xl font-semibold leading-tight tracking-tight", className)}
    {...props} />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
