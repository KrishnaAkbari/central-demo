'use client'

import { Server as ServerIcon, ArrowUpRight, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// UsageMeter — server-usage bar shown on the plans page.
//
// Renders one of four states depending on serverCount vs plan.serverLimit:
//   - unlimited: limit is null → "Unlimited servers" line, no bar, no CTA
//   - healthy:   under 70% of limit → neutral, no CTA
//   - approaching: 70-99% of limit → amber, "X server slots left" + upgrade CTA
//   - over:      at/over limit → red, "Remove a server or upgrade" + both CTAs
//
// The CTAs are action prompts (round 4 explicit goal). Upgrade goes to
// the next-higher plan in NORMAL_PLANS or to /billing/plans (we cannot
// easily rank restructured plans here). Remove goes to /servers.
//
// Tagged with data-testid for the verify suite:
//   - usage-meter        (root)
//   - usage-meter-bar    (the colored fill div)
//   - usage-meter-copy   (the text line)
//   - usage-meter-upgrade, usage-meter-remove (CTA buttons when shown)
export function UsageMeter({ serverCount, plan, onUpgrade, onRemove }) {
  if (!plan) return null

  const limit = plan.serverLimit

  // Unlimited plans (Pro/Master/Business/etc.) — no meter, just a note.
  if (limit == null) {
    return (
      <div
        data-testid="usage-meter"
        className="mt-3 rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white/60 dark:bg-slate-900/40 p-3"
      >
        <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <ServerIcon className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <span data-testid="usage-meter-copy">
            <span className="font-medium">{serverCount}</span> server{serverCount === 1 ? '' : 's'} connected
          </span>
          <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
            Unlimited servers on {plan.name}
          </span>
        </div>
      </div>
    )
  }

  const pct = Math.min(100, Math.round((serverCount / limit) * 100))
  const remaining = Math.max(0, limit - serverCount)
  const isOver = serverCount > limit
  const isApproaching = !isOver && pct >= 70

  // Color tone selection: red over, amber approaching, slate healthy.
  const tone = isOver
    ? {
        bar: 'bg-red-500 dark:bg-red-400',
        track: 'bg-red-100 dark:bg-red-500/20',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-300 dark:border-red-500/40',
        bg: 'bg-red-50/60 dark:bg-red-500/10',
      }
    : isApproaching
    ? {
        bar: 'bg-amber-500 dark:bg-amber-400',
        track: 'bg-amber-100 dark:bg-amber-500/20',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-300 dark:border-amber-500/40',
        bg: 'bg-amber-50/60 dark:bg-amber-500/10',
      }
    : {
        bar: 'bg-indigo-500 dark:bg-indigo-400',
        track: 'bg-slate-200/70 dark:bg-slate-700/60',
        text: 'text-slate-700 dark:text-slate-200',
        border: 'border-slate-200/70 dark:border-slate-700/70',
        bg: 'bg-white/60 dark:bg-slate-900/40',
      }

  return (
    <div
      data-testid="usage-meter"
      className={cn(
        'mt-3 rounded-lg border p-3',
        tone.border,
        tone.bg,
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p data-testid="usage-meter-copy" className={cn('text-sm', tone.text)}>
          <span className="font-medium">{serverCount}</span> of{' '}
          <span className="font-medium">{limit}</span> server slot{limit === 1 ? '' : 's'} used
          {isOver ? (
            <span className="ml-2 font-medium">
              — over by {serverCount - limit}
            </span>
          ) : isApproaching ? (
            <span className="ml-2">
              — {remaining} slot{remaining === 1 ? '' : 's'} left
            </span>
          ) : null}
        </p>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {pct}%
        </span>
      </div>
      <div
        className={cn('mt-2 h-2 w-full rounded-full overflow-hidden', tone.track)}
        role="progressbar"
        aria-valuenow={serverCount}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${serverCount} of ${limit} server slots used`}
      >
        <div
          data-testid="usage-meter-bar"
          className={cn('h-full rounded-full transition-all', tone.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Action prompts — explicit "what to do next" line. Always shown
          when there is a real signal (over or approaching). Hidden when
          the user is well under their limit. */}
      {(isOver || isApproaching) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isOver && (
            <p className={cn('text-xs', tone.text)}>
              You need to free up at least {serverCount - limit} server slot
              {serverCount - limit === 1 ? '' : 's'} or upgrade to keep connecting new ones.
            </p>
          )}
          {isApproaching && !isOver && (
            <p className={cn('text-xs', tone.text)}>
              You're approaching your limit. Upgrade to avoid running out of slots.
            </p>
          )}
          {onUpgrade && (
            <button
              type="button"
              data-testid="usage-meter-upgrade"
              onClick={onUpgrade}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors',
                tone.border,
                isOver
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 dark:bg-red-500 dark:hover:bg-red-600 dark:border-red-500'
                  : 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 dark:bg-amber-500 dark:hover:bg-amber-600 dark:border-amber-500',
              )}
            >
              Upgrade plan
              <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
          {isOver && onRemove && (
            <button
              type="button"
              data-testid="usage-meter-remove"
              onClick={onRemove}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Manage servers
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
