'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  TRIAL_DURATION_DAYS,
  TRIAL_EXPIRY_SOON_DAYS,
} from '@/services/billingApi'

// TrialCard — single card handling all three trial lifecycle states:
//   1. eligible: trial has not started, user is on Free, "Start trial" CTA
//   2. active:   trial in progress, days remaining + warning if expiring
//   3. expired:  trial ended, fallback to Free, "Choose a plan" CTA
//
// Variant stays consistent (single card shape) so the user always sees
// the same control in the same place during their trial lifecycle. Tone
// shifts the bg / icon / CTA label / urgency language.
//
// Days remaining is computed from the live `trialExpiresAt` so the
// number updates on its own. We tick every minute so expiring-soon
// state advances without a reload.
function computeDaysRemaining(trialExpiresAt) {
  if (!trialExpiresAt) return 0
  const ms = new Date(trialExpiresAt).getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / 86400000)
}

export function TrialCard({ state, trialExpiresAt, onStartTrial }) {
  // Live tick: re-render once a minute so the days-remaining stays
  // current without a page refresh.
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const variant = (() => {
    if (state === 'trial_eligible') return 'eligible'
    if (state === 'trial_active') {
      const days = computeDaysRemaining(trialExpiresAt)
      return days <= TRIAL_EXPIRY_SOON_DAYS ? 'expiring' : 'active'
    }
    if (state === 'trial_expired') return 'expired'
    return null
  })()

  if (!variant) return null

  if (variant === 'eligible') {
    return (
      <Card className="relative overflow-hidden p-5 border-indigo-200 dark:border-indigo-500/40 bg-gradient-to-br from-indigo-50 via-white to-white dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4 min-w-0 lg:flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-500/20 shrink-0">
              <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Try it free for {TRIAL_DURATION_DAYS} days
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Start a {TRIAL_DURATION_DAYS}-day trial — full plan access, no credit card required. Plan change during the trial applies immediately with no charge.
              </p>
              <Button
                type="button"
                className="mt-4"
                onClick={onStartTrial}
              >
                Start {TRIAL_DURATION_DAYS}-day trial
              </Button>
            </div>
          </div>
          {/* Right column: trial-facts panel. On lg+, fills the empty
              right half of the card with concrete numbers so the user
              sees at-a-glance what they're committing to. Hidden on
              mobile — the bullet list would stack awkwardly there. */}
          <div className="hidden lg:block lg:w-64 lg:shrink-0 lg:rounded-lg lg:border lg:border-indigo-200/70 lg:bg-white/60 lg:p-3 lg:dark:border-indigo-500/30 lg:dark:bg-slate-900/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Trial includes
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden />
                <span>{TRIAL_DURATION_DAYS} full days</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden />
                <span>Unlimited servers</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden />
                <span>Priority support</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden />
                <span>Daily backups</span>
              </li>
            </ul>
          </div>
        </div>
      </Card>
    )
  }

  if (variant === 'active' || variant === 'expiring') {
    const days = computeDaysRemaining(trialExpiresAt)
    const isExpiring = variant === 'expiring'
    return (
      <Card
        className={cn(
          'p-5',
          isExpiring
            ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-500/10'
            : 'border-indigo-200 dark:border-indigo-500/40 bg-indigo-50/60 dark:bg-indigo-500/10',
        )}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4 min-w-0 lg:flex-1">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl shrink-0',
              isExpiring ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-indigo-100 dark:bg-indigo-500/20',
            )}>
              {isExpiring
                ? <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                : <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              }
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {isExpiring
                  ? `Trial ends in ${days} day${days === 1 ? '' : 's'}`
                  : `Trial — ${days} day${days === 1 ? '' : 's'} remaining`}
              </h3>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                {isExpiring
                  ? `Pick a plan before ${new Date(trialExpiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} or your org falls back to Free.`
                  : `You have full access during the trial. You can change plans anytime during the trial — no charge until the trial ends.`}
              </p>
              <Button
                type="button"
                variant={isExpiring ? 'default' : 'outline'}
                className="mt-4"
              >
                Choose a plan
              </Button>
            </div>
          </div>
          {/* Right column: trial-ends impact list, moved out of the
              left column to give the card a real two-column shape.
              Stays inline below the description on mobile (single-
              column stack). */}
          <div
            data-testid="trial-impact"
            className="lg:w-72 lg:shrink-0 lg:rounded-lg lg:border lg:border-slate-200/70 lg:bg-white/60 lg:p-3 lg:dark:border-slate-700/70 lg:dark:bg-slate-900/40"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              When your trial ends, you'll be moved to Free
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 dark:text-slate-500 mt-1.5 h-1 w-1 rounded-full bg-current shrink-0" aria-hidden />
                <span><span className="font-medium">1 server</span> only (down from your current access)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 dark:text-slate-500 mt-1.5 h-1 w-1 rounded-full bg-current shrink-0" aria-hidden />
                <span><span className="font-medium">Community support</span> instead of priority</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 dark:text-slate-500 mt-1.5 h-1 w-1 rounded-full bg-current shrink-0" aria-hidden />
                <span><span className="font-medium">Basic backups</span> instead of daily or hourly</span>
              </li>
            </ul>
          </div>
        </div>
      </Card>
    )
  }

  // expired
  return (
    <Card className="p-5 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4 min-w-0 lg:flex-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0">
            <CheckCircle2 className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Trial ended — you are on Free
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Your organization fell back to Free. Here's what you have now, and what's gated until you pick a paid plan.
            </p>
            <Button type="button" variant="outline" className="mt-4">
              Choose a paid plan
            </Button>
          </div>
        </div>
        {/* Right column: what-you-have-on-Free panel, separated from
            the message + CTA on the left so the card actually fills
            its available width. */}
        <div
          data-testid="trial-impact-expired"
          className="lg:w-72 lg:shrink-0 lg:rounded-lg lg:border lg:border-slate-200 lg:bg-white lg:p-3 lg:dark:border-slate-700 lg:dark:bg-slate-900"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            What you have on Free
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" aria-hidden />
              <span>1 server</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" aria-hidden />
              <span>Community support</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" aria-hidden />
              <span>Basic backups</span>
            </li>
          </ul>
        </div>
      </div>
    </Card>
  )
}