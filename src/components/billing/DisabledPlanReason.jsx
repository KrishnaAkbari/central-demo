'use client'

import { AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

// DisabledPlanReason — inline callout shown on plan cards that the user
// cannot pick. The tone is informative, not punitive: explain WHY this
// plan is unavailable AND what the user can do instead (per Krishna's
// brief: "Do not just disable buttons. Show clear reason and what user
// can do.").
//
// tone="warning" — Amber, e.g. limit-based disables ("Free is
//   unavailable because this organization has N servers").
// tone="info" — Indigo/Sky, e.g. downgrade-from-business.
export function DisabledPlanReason({ reason, tone = 'warning', className }) {
  if (!reason) return null

  const palette = tone === 'info'
    ? {
        bg: 'bg-sky-50 dark:bg-sky-500/10',
        border: 'border-sky-200 dark:border-sky-500/30',
        text: 'text-sky-800 dark:text-sky-200',
        Icon: Info,
      }
    : {
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        border: 'border-amber-200 dark:border-amber-500/30',
        text: 'text-amber-800 dark:text-amber-200',
        Icon: AlertCircle,
      }

  const Icon = palette.Icon

  return (
    <div
      className={cn(
        'mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-snug',
        palette.bg, palette.border, palette.text, className,
      )}
    >
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium">{reason}</p>
      </div>
    </div>
  )
}