'use client'

import { Check } from 'lucide-react'

/**
 * Stepper — horizontal 4-step progress for the Create Server wizard.
 *
 * Renders a number/badge for each step. Steps after the current one are
 * muted; the current step is accent; completed steps are accent + check.
 * Lines between circles fill in as steps complete.
 */
export function Stepper({ steps, currentIndex }) {
  return (
    <ol className="flex items-center w-full">
      {steps.map((label, idx) => {
        const done = idx < currentIndex
        const active = idx === currentIndex
        const isLast = idx === steps.length - 1
        return (
          <li
            key={label}
            className={
              'flex items-center gap-2 ' +
              (isLast ? '' : 'flex-1')
            }
            aria-current={active ? 'step' : undefined}
          >
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={
                  'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ' +
                  (done
                    ? 'bg-indigo-600 text-white'
                    : active
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400')
                }
              >
                {done ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={
                  'text-sm whitespace-nowrap ' +
                  (active
                    ? 'font-semibold text-slate-900 dark:text-white'
                    : done
                      ? 'font-medium text-slate-700 dark:text-slate-200'
                      : 'text-slate-500 dark:text-slate-400')
                }
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <div
                className={
                  'flex-1 h-px mx-1 ' +
                  (done ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700')
                }
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
