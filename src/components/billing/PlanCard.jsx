'use client'

import { Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DisabledPlanReason } from './DisabledPlanReason'
import { PlanSwitchDiff } from './PlanSwitchDiff'
import { getPlanSwitchDiff } from '@/services/billingApi'

// PlanCard — visual + state container for a single recurring plan on
// the Plans page.
//
// state variants:
//   - 'current'    = the org's active plan. Indigo border, "Current plan" badge,
//                    CTAs hidden. Used so users see their state without noise.
//   - 'available'  = a plan the user can switch to. Default white card,
//                    primary CTA = "Choose plan".
//   - 'downgrade'  = same as available but the CTA reads "Downgrade" and
//                    opens the checkout. Downgrade rules still apply; the
//                    server-limit checks are gated by DisabledPlanReason.
//   - 'disabled'   = plan exists but is currently unavailable for this org.
//                    CTA hidden, DisabledPlanReason shown instead.
//
// `onSelect` is the only required action — called with plan.id when the
// user clicks "Choose plan" / "Downgrade" / "Switch to this plan".
export function PlanCard({
  plan,
  state = 'available',
  disabledReason = null,
  disabledReasonTone = 'warning',
  cycle = 'monthly',
  yearlyDiscount = 0.20,
  onSelect,
  isPopular = false,
  currentTier = null,
}) {
  const isCurrent = state === 'current'
  const isDowngrade = state === 'downgrade'
  const isDisabled = state === 'disabled'
  const noCta = isCurrent || isDisabled
  // Plan-switch diff (round 6): only computed when this is not the
  // current plan, so the "current" card stays compact.
  const switchDiff = !isCurrent ? getPlanSwitchDiff(currentTier, plan.id) : null

  const showMonthly = cycle === 'monthly'
  const monthlyPrice = plan.priceUsd || 0
  const yearlyMonthly = monthlyPrice * (1 - yearlyDiscount)
  const displayPrice = showMonthly ? monthlyPrice : yearlyMonthly

  return (
    <Card
      className={cn(
        'relative flex flex-col p-5 transition-all',
        isCurrent && 'border-indigo-300 dark:border-indigo-500/60 ring-1 ring-indigo-100 dark:ring-indigo-500/20',
        !isCurrent && !isDisabled && 'hover:border-slate-300 dark:hover:border-slate-700',
        isDisabled && 'opacity-90',
      )}
    >
      {/* Top row: name + badges */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {plan.name}
          </h3>
          {plan.badge && (
            <Badge variant="info" className="text-xxs">{plan.badge}</Badge>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {isCurrent && (
            <Badge variant="indigo">Current plan</Badge>
          )}
          {isPopular && !isCurrent && (
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-3 w-3" />
              Popular
            </span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[24px] sm:text-[24px] font-bold text-slate-900 dark:text-white">
          ${displayPrice.toFixed(displayPrice % 1 === 0 ? 0 : 2)}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          / mo
        </span>
        {!showMonthly && plan.priceUsd > 0 && (
          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
            (billed yearly)
          </span>
        )}
      </div>
      {!showMonthly && plan.priceUsd > 0 && (
        <p className="text-2xs text-emerald-600 dark:text-emerald-400 mt-0.5">
          You save ${(monthlyPrice * yearlyDiscount * 12).toFixed(0)}/year vs monthly
        </p>
      )}

      {/* Server limit */}
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
        {plan.serverLimit === null
          ? 'Unlimited servers'
          : `${plan.serverLimit} server${plan.serverLimit === 1 ? '' : 's'}`}
        {plan.contactSales && (
          <span className="ml-2 text-slate-500">· Custom SLA</span>
        )}
      </p>

      {/* Features */}
      {plan.features?.length > 0 && (
        <ul className="mt-4 space-y-2 flex-1">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500 dark:text-emerald-400" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Support level */}
      {plan.support && (
        <p className="mt-3 text-2xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Support: {formatSupportLevel(plan.support)}
        </p>
      )}

      {/* Disabled reason callout */}
      {isDisabled && disabledReason && (
        <DisabledPlanReason reason={disabledReason} tone={disabledReasonTone} />
      )}

      {/* Plan-switch diff teaser (round 6) — only when switching to a
          non-current plan. Hidden for the current plan (no comparison)
          and for plans with no diff data (legacy fallback). */}
      {switchDiff && (switchDiff.gainsCount > 0 || switchDiff.lossesCount > 0 || switchDiff.priceDeltaUsd !== 0) && (
        <PlanSwitchDiff diff={switchDiff} />
      )}

      {/* CTA */}
      {!noCta && (
        <Button
          type="button"
          className="mt-5 w-full"
          variant={isDowngrade ? 'outline' : 'default'}
          onClick={() => onSelect && onSelect(plan.id)}
        >
          {isDowngrade ? 'Downgrade to this plan' : 'Choose this plan'}
        </Button>
      )}
      {isCurrent && (
        <div className="mt-5 w-full text-center text-xs text-slate-500 dark:text-slate-400 py-2.5 rounded-md border border-dashed border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-500/5">
          You are on this plan
        </div>
      )}
    </Card>
  )
}

function formatSupportLevel(s) {
  switch (s) {
    case 'community':      return 'Community'
    case 'email':          return 'Email'
    case 'priority_email': return 'Priority email'
    case 'priority_chat':  return 'Priority chat'
    case '247_chat':       return '24/7 chat'
    case 'dedicated':      return 'Dedicated CSM'
    default:               return s
  }
}