'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock, AlertTriangle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TRIAL_EXPIRY_SOON_DAYS,
  getActiveOrgId,
  getBillingStateForOrg,
} from '@/services/billingApi'

// TrialStickyBar — appears at the top of every /billing/* page when the
// active org is in active trial. Sits inside the scrollable content
// area (between the sticky tabs and the page body) so it scrolls with
// the page rather than competing with the tabs for sticky real estate.
//
// Hidden on /billing/overview because the Overview hero block already
// shows the same trial info in detail — the bar would duplicate.
//
// Not dismissible during active trial. The only ways it disappears:
//   1. User picks a paid plan (state → active, no trial)
//   2. Trial expires (state → trial_expired, no longer trial_active)
//   3. User leaves the /billing/* section
//
// Tone escalation (matches TrialCard pattern):
//   3-7 days remaining → indigo (calm)
//   1-2 days remaining → amber (expiring)
//   0 days remaining   → amber (still trial_active until tick crosses)
//
// aria-live="polite" announces countdown updates to screen readers
// without interrupting whatever they were reading.

function computeDaysRemaining(trialExpiresAt) {
  if (!trialExpiresAt) return 0
  const ms = new Date(trialExpiresAt).getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / 86400000)
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function TrialStickyBar() {
  const pathname = usePathname() || ''
  const [state, setState] = useState(null)
  const [, setTick] = useState(0)

  // Read state on mount, then on persona / state changes (custom event
  // dispatched by billingApi.seedPersona / startTrial / cancelRecurring
  // / resumeRecurring / checkoutRecurring / checkoutLifetime).
  useEffect(() => {
    const read = () => {
      const orgId = getActiveOrgId()
      if (!orgId) {
        setState(null)
        return
      }
      setState(getBillingStateForOrg(orgId))
    }
    read()
    window.addEventListener('billing:state-changed', read)
    window.addEventListener('storage', read)
    return () => {
      window.removeEventListener('billing:state-changed', read)
      window.removeEventListener('storage', read)
    }
  }, [])

  // Live tick so days-remaining stays current without reload.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  // Hide when:
  //  1. State isn't loaded yet (avoid flash on first paint)
  //  2. Not in active trial (eligible / expired / never / converted)
  //  3. On /billing (redirects to overview, the bar wouldn't render anyway)
  //  4. On /billing/overview (hero block already shows this)
  if (!state || state.trialState !== 'trial_active') return null
  if (pathname === '/billing') return null
  if (pathname === '/billing/overview' || pathname.startsWith('/billing/overview/')) return null

  const days = computeDaysRemaining(state.trialExpiresAt)
  const expiring = days <= TRIAL_EXPIRY_SOON_DAYS
  const Icon = expiring ? AlertTriangle : Clock

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Trial countdown"
      data-testid="trial-sticky-bar"
      className={cn(
        'border-b px-4 sm:px-6 py-3',
        expiring
          ? 'bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-100'
          : 'bg-indigo-100 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-500/40 text-indigo-900 dark:text-indigo-100',
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Icon
            className={cn(
              'h-4 w-4 shrink-0',
              expiring
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-indigo-600 dark:text-indigo-400',
            )}
            aria-hidden="true"
          />
          <p className="text-sm font-medium truncate">
            <span data-testid="trial-days">
              Trial — {days} day{days === 1 ? '' : 's'} remaining
            </span>
            <span
              data-testid="trial-ends"
              className="hidden sm:inline text-slate-600 dark:text-slate-400 font-normal"
            >
              {' '}· ends {fmtDate(state.trialExpiresAt)}
            </span>
          </p>
        </div>
        <Link
          href="/billing/plans"
          data-testid="trial-cta"
          className={cn(
            'inline-flex items-center gap-1 text-sm font-semibold whitespace-nowrap shrink-0 self-start sm:self-auto',
            expiring
              ? 'text-amber-700 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-50'
              : 'text-indigo-700 dark:text-indigo-200 hover:text-indigo-900 dark:hover:text-indigo-50',
          )}
        >
          Choose a plan
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}