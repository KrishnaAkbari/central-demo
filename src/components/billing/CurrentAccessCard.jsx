'use client'

import { useRouter } from 'next/navigation'
import { Crown, Wallet, Server as ServerIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { UsageMeter } from '@/components/billing/UsageMeter'

// CurrentAccessCard — top-of-Plans-page card showing the org's current
// access + lifetime banner (when applicable). Lighter than the
// Overview summary card (no transactions, no recommended action); the
// Overview page is where those live. This card's job is to remind
// users of their state while they're browsing plans and to redirect
// lifetime users to the lifetime section.
//
// lifetime → card swaps body to "You're on a lifetime deal. Manage it
// in Lifetime Deals." with a CTA to /billing/lifetime.
export function CurrentAccessCard({ state, plan, walletBalance, serverCount }) {
  const router = useRouter()

  if (!state) return null
  if (state.status === 'lifetime_active') {
    return (
      <Card className="p-5 border-amber-300 dark:border-amber-500/40 bg-gradient-to-br from-amber-50 via-white to-white dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20 shrink-0">
            <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              You are on a lifetime deal
            </h3>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
              {plan?.name || 'Lifetime'} — unlimited servers, no renewals. Manage your lifetime deal and any extra server slots in the Lifetime Deals section.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={() => router.push('/billing/lifetime')}>
                Go to Lifetime Deals
              </Button>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const currentName = plan?.name || 'Free'
  const isTrialActive = state.trialState === 'trial_active'

  // Plain-English renewal banner. Replaces the terse "Renews 8/4/2026" with
  // a sentence that makes the next charge and the cancellation promise
  // explicit. Uses long-form dates so it reads as a sentence, not a data row.
  const longDate = state.currentPeriodEnd
    ? new Date(state.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null
  const renewalPrice = plan?.priceUsd

  // Days-until-renewal: turns the absolute date in the banner into a
  // concrete "X days" counter, which is the more useful piece of data
  // for users deciding whether to upgrade or cancel today. Computed
  // once — re-renders only when longDate changes.
  const daysUntilRenewal = longDate
    ? Math.max(0, Math.ceil((new Date(longDate).getTime() - Date.now()) / 86400000))
    : null

  return (
    <Card className="p-5">
      {/* Two-column layout on lg: left = state/plan/usage (was filling the
          whole card before), right = renewal + key stats that were getting
          hidden in the left column. Stacks on mobile. Both columns keep
          their own logical grouping so the card reads top-to-bottom on
          small viewports and side-by-side on wide ones. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 lg:flex-1">
          <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Current access
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            {currentName}
            {isTrialActive && (
              <Badge variant="info" className="ml-2 align-middle">Trial</Badge>
            )}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              Wallet ${walletBalance.toFixed(2)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ServerIcon className="h-3.5 w-3.5" />
              {serverCount} server{serverCount === 1 ? '' : 's'}
            </span>
          </div>
          {/* Usage meter (round 4) — replaces the inert "{count} servers"
              text with a live progress bar and concrete action prompts
              (upgrade / manage servers) when the user is close to or
              over their plan's server limit. Hidden when the plan has
              no server cap (Pro/Master/Business/lifetime). */}
          <UsageMeter
            serverCount={serverCount}
            plan={plan}
            onUpgrade={() => {
              // The plans grid is right below this card; an in-page
              // anchor gives the user the context-switch-free next step
              // without bouncing them around.
              const grid = document.getElementById('plan-grid')
              if (grid) {
                grid.scrollIntoView({ behavior: 'smooth', block: 'start' })
                grid.focus?.()
              }
            }}
            onRemove={() => router.push('/servers')}
          />
        </div>

        {/* Right column: renewal + status summary, the data that
            actually drives the user's next decision (cancel vs stay,
            upgrade vs downgrade). Hidden entirely on mobile because
            long-form renewal language reads long in a 1-column stack;
            mobile users see the renewal banner inline below. */}
        <div className="hidden lg:block lg:w-72 lg:shrink-0 lg:border-l lg:border-slate-200 lg:pl-6 lg:dark:border-slate-700">
          {longDate && state.status === 'active' && renewalPrice > 0 ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Next renewal
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white tabular-nums">
                  {longDate}
                </p>
                {daysUntilRenewal != null && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    in {daysUntilRenewal} day{daysUntilRenewal === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Renewal cost
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white tabular-nums">
                  ${renewalPrice.toFixed(2)}/mo
                </p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cancel anytime before {longDate} to stop the next charge.
              </p>
            </div>
          ) : longDate && state.status === 'canceled' ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Access ends
                </p>
                <p className="mt-1 text-lg font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
                  {longDate}
                </p>
                {daysUntilRenewal != null && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    in {daysUntilRenewal} day{daysUntilRenewal === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                You'll be moved to Free after this date. Resume anytime before then to keep your current plan.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Renewal banner — shown only on mobile + when not already in
          the right column. On lg+, the right-column block carries the
          same info in a denser layout. On mobile, the long plain-
          English sentence reads well stacked full-width. */}
      <div className="lg:hidden">
        {longDate && state.status === 'active' && renewalPrice > 0 && (
          <p
            data-testid="renewal-banner"
            className="mt-4 text-sm text-slate-700 dark:text-slate-200"
          >
            Your <span className="font-medium">{currentName}</span> plan renews on{' '}
            <span className="font-medium">{longDate}</span> for{' '}
            <span className="font-medium">${renewalPrice.toFixed(2)}/mo</span>.{' '}
            Cancel anytime before then to stop the next charge.
          </p>
        )}
        {longDate && state.status === 'canceled' && (
          <p
            data-testid="renewal-banner-canceled"
            className="mt-4 text-sm text-amber-700 dark:text-amber-300"
          >
            Your access continues until <span className="font-medium">{longDate}</span>.
            You'll be moved to Free after that.
          </p>
        )}
      </div>
    </Card>
  )
}