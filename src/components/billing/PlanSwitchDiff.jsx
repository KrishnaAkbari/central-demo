'use client'

import { useState } from 'react'
import { ArrowUp, ArrowDown, ArrowRight, Minus, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// PlanSwitchDiff — inline "What changes if I switch?" panel on PlanCard
// (round 6). Pattern: Linear-style destructive-action disclosure —
// always-visible teaser line, click to expand a categorized list of
// gains/losses + price delta. Collapsed by default so the cards stay
// scannable. The CTA below the panel is the actual action; the panel
// exists to make that action informed.
//
// Tagged with data-testid for the verify suite:
//   - plan-diff-teaser        (always visible)
//   - plan-diff-toggle        (expand/collapse button)
//   - plan-diff-panel         (expanded body)
//   - plan-diff-row-gain      (gain row)
//   - plan-diff-row-loss      (loss row)
//   - plan-diff-price-up      (price delta line when paying more)
//   - plan-diff-price-down    (price delta line when paying less)
//   - plan-diff-price-same    (price delta line when same)

function fmtVal(row, val) {
  if (val == null) return '—'
  if (row.kind === 'bool') return val ? 'Included' : 'Not included'
  if (row.kind === 'price') {
    const n = Number(val)
    if (!n) return '—'
    return `$${n.toFixed(2)}/slot`
  }
  return String(val)
}

export function PlanSwitchDiff({ diff }) {
  const [open, setOpen] = useState(false)
  if (!diff) return null
  const { fromTier, toTier, priceDeltaUsd, priceDeltaPct, categories, gainsCount, lossesCount } = diff
  if (!fromTier || !toTier || fromTier === toTier) return null

  const priceUp = priceDeltaUsd > 0
  const priceDown = priceDeltaUsd < 0
  const priceSame = priceDeltaUsd === 0

  return (
    <div
      data-testid="plan-diff"
      className="mt-3 border-t border-slate-200/70 dark:border-slate-700/70 pt-3"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="plan-diff-toggle"
        onClick={() => setOpen((o) => !o)}
        className="w-full justify-between px-2 h-8 text-xs font-medium"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />}
          <span data-testid="plan-diff-teaser" className="truncate text-slate-700 dark:text-slate-200">
            {gainsCount === 0 && lossesCount === 0 ? (
              'Same features, different price'
            ) : (
              <>
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                  +{gainsCount}
                </span>
                {' '}
                <span className="text-slate-500 dark:text-slate-400">
                  {gainsCount === 1 ? 'gain' : 'gains'}
                </span>
                {lossesCount > 0 ? (
                  <>
                    {' '}
                    <span className="text-slate-400 dark:text-slate-500">·</span>
                    {' '}
                    <span className="text-red-700 dark:text-red-300 font-medium">
                      −{lossesCount}
                    </span>
                    {' '}
                    <span className="text-slate-500 dark:text-slate-400">
                      {lossesCount === 1 ? 'loss' : 'losses'}
                    </span>
                  </>
                ) : null}
              </>
            )}
          </span>
        </span>
        {priceUp && (
          <span data-testid="plan-diff-price-up" className="text-red-700 dark:text-red-300 font-medium shrink-0">
            +${Math.abs(priceDeltaUsd).toFixed(2)}/mo
          </span>
        )}
        {priceDown && (
          <span data-testid="plan-diff-price-down" className="text-emerald-700 dark:text-emerald-300 font-medium shrink-0">
            −${Math.abs(priceDeltaUsd).toFixed(2)}/mo
          </span>
        )}
        {priceSame && (
          <span data-testid="plan-diff-price-same" className="text-slate-500 dark:text-slate-400 shrink-0">
            same price
          </span>
        )}
      </Button>

      {open && (
        <div
          data-testid="plan-diff-panel"
          className="mt-2 rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-900/40 p-2.5 space-y-2"
        >
          {priceDeltaPct != null && priceDeltaPct !== 0 && (
            <p className={cn(
              'text-xs px-1',
              priceUp ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
            )}>
              {priceUp ? 'Paying more' : 'Paying less'} by {Math.abs(priceDeltaPct)}%
            </p>
          )}
          {categories.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
              The feature set is the same — only the price changes.
            </p>
          ) : (
            categories.map((cat) => (
              <div key={cat.category}>
                <p className="text-xxs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 px-1">
                  {cat.category}
                </p>
                <ul className="mt-1 space-y-1">
                  {cat.rows.map((row) => (
                    <li
                      key={row.rowId}
                      data-testid={row.direction === 'gain' ? 'plan-diff-row-gain' : 'plan-diff-row-loss'}
                      className={cn(
                        'flex items-start gap-2 px-1 text-xs',
                        row.direction === 'gain'
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-red-700 dark:text-red-300'
                      )}
                    >
                      {row.direction === 'gain'
                        ? <Plus className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        : <Minus className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      }
                      <span className="flex-1 min-w-0">
                        <span className="font-medium">{row.label}:</span>{' '}
                        <span className="text-slate-600 dark:text-slate-300 line-through tabular-nums">
                          {fmtVal(row, row.from)}
                        </span>
                        {' '}
                        <ArrowRight className="inline h-3 w-3 align-middle text-slate-400" />
                        {' '}
                        <span className="font-medium tabular-nums">
                          {fmtVal(row, row.to)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}


