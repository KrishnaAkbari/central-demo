'use client'

import { cn } from '@/lib/utils'

// BillingCycleToggle — Monthly / Yearly switch. Yearly is presented as
// "Save 20%" (a standard SaaS pattern; matches Linear / Vercel / Cal.com).
// For mock-only billing the yearly math is informational only — the
// underlying checkoutRecurring still bills monthly in this prototype.
//
// Visual: pill-shaped segmented control, indigo active segment, neutral
// inactive. Single source of truth — caller owns the state and passes
// the current value + onChange.
export function BillingCycleToggle({ value, onChange, yearlyDiscount = 0.20, className }) {
  const isYearly = value === 'yearly'

  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <div
        className={cn(
          'inline-flex items-center rounded-full p-1',
          'bg-slate-100 dark:bg-slate-800/60',
          'border border-slate-200 dark:border-slate-700',
        )}
        role="radiogroup"
        aria-label="Billing cycle"
      >
        <button
          type="button"
          role="radio"
          aria-checked={!isYearly}
          onClick={() => onChange('monthly')}
          data-testid="cycle-toggle-monthly"
          className={cn(
            'px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
            !isYearly
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white ring-1 ring-slate-200 dark:ring-slate-700'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white',
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isYearly}
          onClick={() => onChange('yearly')}
          data-testid="cycle-toggle-yearly"
          className={cn(
            'px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
            isYearly
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white ring-1 ring-slate-200 dark:ring-slate-700'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white',
          )}
        >
          Yearly
        </button>
      </div>
      {isYearly && (
        <span
          data-testid="cycle-yearly-save-badge"
          className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
        >
          Save {Math.round(yearlyDiscount * 100)}%
        </span>
      )}
    </div>
  )
}