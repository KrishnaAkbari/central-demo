'use client'

import { X, RotateCcw, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// RecurringActions — Cancel / Resume button cluster. Shown on the Plans
// page ONLY for paid recurring plans (cancel is hidden for Free).
// Renders inside a small action strip below the CurrentAccessCard.
//
// state === 'active' (paid)       -> Cancel Plan
// state === 'canceled'            -> Resume Plan (and a "continues until" hint)
// state === 'trial_active'        -> "Cancel trial" + "Convert now"
// otherwise                       -> null (Free / Lifetime / Trial eligible)
//
// Cancel/Resume are direct mutations in Round 2. The full checkout flow
// (downgrade / upgrade) lands in Round 3 — see CheckoutDialog stub.
export function RecurringActions({ state, currentPeriodEnd, onCancel, onResume }) {
  // Cancel is only meaningful for paid recurring plans. Free users have
  // nothing to cancel (they'd just stay on Free) and Lifetime users
  // manage their deal on the Lifetime tab.
  const paidActive = state?.status === 'active' && !isLifetime(state) && state?.planTier !== 'free'
  const showCancel = paidActive
  const showResume = state?.status === 'canceled'

  if (!showCancel && !showResume) return null

  return (
    <Card className="p-4 bg-slate-50/60 dark:bg-slate-800/30 border-dashed border-slate-300 dark:border-slate-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
            <CalendarClock className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {showResume ? 'Plan canceled' : 'Manage subscription'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {showResume && currentPeriodEnd
                ? `Access continues until ${new Date(currentPeriodEnd).toLocaleDateString()}. Resume now to keep paid access.`
                : 'Canceling stops the next renewal. Access continues until the end of the current period.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {showCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50 dark:border-rose-500/40 dark:hover:bg-rose-500/10"
            >
              <X className="h-4 w-4" />
              Cancel plan
            </Button>
          )}
          {showResume && (
            <Button type="button" onClick={onResume}>
              <RotateCcw className="h-4 w-4" />
              Resume plan
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

// Helper: detect lifetime-active from state without importing the full
// getPlanForOrg graph here. Mirrors the shape used in billingApi.
function isLifetime(state) {
  return state && state.status === 'lifetime_active'
}