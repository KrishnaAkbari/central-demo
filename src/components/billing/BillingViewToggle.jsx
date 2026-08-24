'use client'

import { LayoutGrid, TableProperties } from 'lucide-react'
import { cn } from '@/lib/utils'

// BillingViewToggle — "Cards / Compare features" segmented control for
// the /billing/plans page. Mirrors BillingCycleToggle styling (pill
// segmented control, indigo active).
//
// `value`: 'cards' | 'compare'
// `onChange(value)`: caller owns state.
//
// Local persistence: caller passes the current value in. Persisting to
// localStorage so the user's choice survives reload is the caller's job
// (done by the page).
export function BillingViewToggle({ value, onChange, className }) {
  const isCards = value === 'cards'
  return (
    <div
      className={cn('inline-flex items-center gap-3', className)}
    >
      <div
        className={cn(
          'inline-flex items-center rounded-full p-1',
          'bg-slate-100 dark:bg-slate-800/60',
          'border border-slate-200 dark:border-slate-700',
        )}
        role="radiogroup"
        aria-label="Plans view"
      >
        <button
          type="button"
          role="radio"
          aria-checked={isCards}
          onClick={() => onChange('cards')}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
            isCards
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white ring-1 ring-slate-200 dark:ring-slate-700'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white',
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Cards
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!isCards}
          onClick={() => onChange('compare')}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
            !isCards
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white ring-1 ring-slate-200 dark:ring-slate-700'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white',
          )}
        >
          <TableProperties className="h-3.5 w-3.5" />
          Compare features
        </button>
      </div>
    </div>
  )
}