'use client'

import { Fragment, useState, useEffect } from 'react'
import Link from 'next/link'
import { Check, Minus, ArrowRight, Sparkles, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FEATURE_MATRIX,
  PLAN_MATRIX_VALUES,
  PLAN_RANKS,
  getCurrentPlanId,
} from '@/services/billingApi'

// PlanMatrix — side-by-side feature comparison table for the recurring
// plans on /billing/plans. Toggleable from "Cards" to "Compare features"
// via the BillingViewToggle at the top of the page.
//
// Design (synthesized from Linear, GitHub, Vercel docs):
//   - Columns = visible plans (filtered by persona).
//   - Rows = features grouped by category.
//   - Cells = value (string) | boolean (Check or Minus) | price ($/mo each).
//   - Current plan column has indigo bg + "Current" badge.
//   - Each column has its own CTA at the bottom — Switch / Current / Locked.
//   - Below md breakpoint, pivots to stacked cards: one card per plan,
//     each card lists the same features with label → value layout
//     (Linear mobile-style pivot).
//   - Yearly mode: per-call `yearly` prop multiplies prices by 12 and
//     switches the unit. Server limit / support tier / etc. don't change
//     (they're not price-dependent).
//
// Edge cases:
//   - Legacy plans render the first column. Most values are "—" since
//     we don't have a legacy feature config; server limit + support tier
//     are filled from the legacy plan's own `serverLimit` prop.
//   - Restructured orgs: only 2 columns (managed, self_managed).
//   - Lifetime users: caller hides the matrix entirely.
//   - Disabled (downgrade block) plans: show lock icon in header CTA + a
//     muted cell tint to indicate the user can't switch here.

function fmtUsd(n) {
  return `$${(Number(n) || 0).toFixed(0)}`
}

function getCellValue(plan, row) {
  // Legacy plan: pull from plan.serverLimit only for 'servers' row.
  // Everything else is "—" because the source data doesn't exist.
  if (plan.id === 'legacy') {
    if (row.id === 'servers') return plan.serverLimit == null ? 'Unlimited' : String(plan.serverLimit)
    if (row.id === 'extra_slot') return '—'
    if (row.id === 'backup_freq') return '—'
    if (row.id === 'backup_retention') return '—'
    if (row.id === 'support_tier') return 'Legacy support'
    if (row.id === 'response_time') return '—'
    if (row.id === 'standard_integ') return false
    if (row.id === 'all_integ') return false
    if (row.id === 'api') return false
    if (row.id === 'white_glove') return false
    return '—'
  }
  const v = PLAN_MATRIX_VALUES[plan.id]
  if (!v || v[row.id] === undefined) return '—'
  return v[row.id]
}

function renderCell(value, row, yearly) {
  if (row.kind === 'bool') {
    if (value === true) {
      return <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" aria-label="Included" />
    }
    return <Minus className="h-4 w-4 text-slate-300 dark:text-slate-600 mx-auto" aria-label="Not included" />
  }
  if (row.kind === 'price') {
    if (!value) return <Minus className="h-4 w-4 text-slate-300 dark:text-slate-600 mx-auto" aria-label="Not available" />
    const monthly = fmtUsd(value)
    if (yearly) {
      const yr = fmtUsd(value * 12)
      return (
        <div className="text-center">
          <div className="font-medium text-slate-900 dark:text-white tabular-nums">{yr}/yr</div>
          <div className="text-xxs text-slate-500 dark:text-slate-400">({monthly}/mo)</div>
        </div>
      )
    }
    return <span className="font-medium text-slate-900 dark:text-white tabular-nums">{monthly}/mo</span>
  }
  return <span className="text-slate-900 dark:text-white">{String(value)}</span>
}

function MatrixHeaderCell({ plan, isCurrent, isDisabled, cycle, onChoose }) {
  const isYearly = cycle === 'yearly'
  const price = plan.priceUsd
  const yearlyPrice = price * 12 * 0.8 // 20% discount
  return (
    <th
      scope="col"
      data-testid={`matrix-col-${plan.id}`}
      data-current={isCurrent ? 'true' : 'false'}
      data-disabled={isDisabled ? 'true' : 'false'}
      className={cn(
        'px-4 pt-5 pb-6 text-left align-top border-b-2 border-slate-300 dark:border-slate-600',
        isCurrent && 'bg-indigo-50/50 dark:bg-indigo-950/20',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {plan.name}
        </span>
        {isCurrent && (
          <Badge variant="indigo" className="rounded text-xxs">
            Current
          </Badge>
        )}
        {plan.popular && !isCurrent && (
          <Badge variant="warning" className="rounded text-xxs gap-0.5">
            <Sparkles className="h-2.5 w-2.5" />
            Popular
          </Badge>
        )}
      </div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {price === 0 ? (
          plan.id === 'free' ? 'Free forever' : 'Custom'
        ) : isYearly ? (
          <span className="tabular-nums">
            <span className="text-base font-semibold text-slate-900 dark:text-white">{fmtUsd(yearlyPrice)}</span>
            <span className="text-slate-500 dark:text-slate-400">/yr</span>
          </span>
        ) : (
          <span className="tabular-nums">
            <span className="text-base font-semibold text-slate-900 dark:text-white">${price}</span>
            <span className="text-slate-500 dark:text-slate-400">/mo</span>
          </span>
        )}
      </div>
      <div className="mt-2">
        {isCurrent ? (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="w-full"
            data-testid={`matrix-cta-${plan.id}`}
          >
            Current plan
          </Button>
        ) : isDisabled ? (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="w-full"
            data-testid={`matrix-cta-${plan.id}`}
          >
            <Lock className="h-3 w-3" />
            Locked
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => onChoose && onChoose(plan.id)}
            data-testid={`matrix-cta-${plan.id}`}
          >
            Switch to {plan.name}
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </th>
  )
}

export function PlanMatrix({ plans, cycle = 'monthly', onChoose, disabledReasonLookup }) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const isYearly = cycle === 'yearly'

  if (plans.length === 0) return null

  // Mobile pivot: stack one card per plan with feature rows inline.
  if (isMobile) {
    return (
      <div className="space-y-4" data-testid="plan-matrix-mobile">
        {plans.map((plan) => {
          const isCurrent = disabledReasonLookup?.current === plan.id
          const isDisabled = !!disabledReasonLookup?.byPlan?.[plan.id] && !isCurrent
          return (
            <div
              key={plan.id}
              data-testid={`matrix-row-mobile-${plan.id}`}
              className={cn(
                'rounded-lg border p-4',
                isCurrent
                  ? 'border-indigo-300 bg-indigo-50/50 dark:border-indigo-500/40 dark:bg-indigo-950/20'
                  : isDisabled
                    ? 'border-slate-200 dark:border-slate-700 opacity-70'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
              )}
            >
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {plan.name}
                </h3>
                {isCurrent && (
                  <Badge variant="indigo" className="rounded text-xxs">
                    Current
                  </Badge>
                )}
                {plan.popular && !isCurrent && (
                  <Badge variant="warning" className="rounded text-xxs gap-0.5">
                    <Sparkles className="h-2.5 w-2.5" />
                    Popular
                  </Badge>
                )}
              </div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                {plan.priceUsd === 0
                  ? (plan.id === 'free' ? 'Free forever' : 'Custom')
                  : isYearly
                    ? `${fmtUsd(plan.priceUsd * 12 * 0.8)}/yr`
                    : `$${plan.priceUsd}/mo`}
              </div>
              <div className="mt-3">
                {isCurrent ? (
                  <Button variant="outline" size="sm" disabled className="w-full">
                    Current plan
                  </Button>
                ) : isDisabled ? (
                  <Button variant="outline" size="sm" disabled className="w-full">
                    <Lock className="h-3 w-3" />
                    Locked
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    onClick={() => onChoose && onChoose(plan.id)}
                  >
                    Switch to {plan.name}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <dl className="mt-4 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                {FEATURE_MATRIX.map((cat) => (
                  <div key={cat.category}>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-2">
                      {cat.category}
                    </dt>
                    <div className="space-y-1.5 mt-1">
                      {cat.rows.map((row) => {
                        const value = getCellValue(plan, row)
                        return (
                          <div key={row.id} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-300">{row.label}</span>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {row.kind === 'bool'
                                ? (value === true
                                    ? <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="Included" />
                                    : <Minus className="h-4 w-4 text-slate-300 dark:text-slate-600" aria-label="Not included" />)
                                : row.kind === 'price'
                                  ? (value
                                      ? <span className="tabular-nums">{fmtUsd(value)}/mo each</span>
                                      : <Minus className="h-4 w-4 text-slate-300 dark:text-slate-600" aria-label="Not available" />)
                                  : <span className="text-slate-900 dark:text-white">{value}</span>}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
      </div>
    )
  }

  // Desktop: a real table.
  return (
    <div className="overflow-x-auto" data-testid="plan-matrix">
      <table className="w-full border-collapse text-sm pb-4">
        <thead>
          <tr>
            <th
              scope="col"
              className="px-4 pt-5 pb-6 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b-2 border-slate-300 dark:border-slate-600"
            >
              Feature
            </th>
            {plans.map((plan) => {
              const isCurrent = disabledReasonLookup?.current === plan.id
              const isDisabled = !!disabledReasonLookup?.byPlan?.[plan.id] && !isCurrent
              return (
                <MatrixHeaderCell
                  key={plan.id}
                  plan={plan}
                  isCurrent={isCurrent}
                  isDisabled={isDisabled}
                  cycle={cycle}
                  onChoose={onChoose}
                />
              )
            })}
          </tr>
        </thead>
        <tbody>
          {FEATURE_MATRIX.map((cat, idx) => (
            <Fragment key={cat.category}>
              <tr
                data-testid={`matrix-section-${cat.category.toLowerCase().replace(/\s+/g, '-')}`}
                className="bg-slate-50/70 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-700"
              >
                <th
                  scope="rowgroup"
                  colSpan={plans.length + 1}
                  className="px-4 pt-5 pb-2.5 text-2xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200 text-left"
                >
                  {cat.category}
                </th>
              </tr>
              {cat.rows.map((row, rowIdx) => (
                <tr
                  key={`${cat.category}-${row.id}`}
                  data-testid={`matrix-row-${row.id}`}
                  className={cn(
                    'border-b border-slate-100 dark:border-slate-800',
                    rowIdx === cat.rows.length - 1 && idx < FEATURE_MATRIX.length - 1 && 'border-b-0',
                  )}
                >
                  <th
                    scope="row"
                    className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-200"
                  >
                    {row.label}
                  </th>
                  {plans.map((plan) => {
                    const value = getCellValue(plan, row)
                    const isCurrent = disabledReasonLookup?.current === plan.id
                    return (
                      <td
                        key={`${plan.id}-${row.id}`}
                        data-testid={`matrix-cell-${plan.id}-${row.id}`}
                        className={cn(
                          'px-4 py-3 text-center',
                          isCurrent && 'bg-indigo-50/50 dark:bg-indigo-950/20',
                        )}
                      >
                        {renderCell(value, row, isYearly)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
