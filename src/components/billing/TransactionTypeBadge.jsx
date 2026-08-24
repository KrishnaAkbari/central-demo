'use client'

import { TONE_CLASSES, getTxTypeMeta } from './transactionLabels'

// Pill that shows a transaction type in a consistent, color-coded chip.
// Used by the Wallet recent-activity card and the Transactions table.
export function TransactionTypeBadge({ type, className = '' }) {
  const meta = getTxTypeMeta(type)
  const tone = TONE_CLASSES[meta.tone] || TONE_CLASSES.slate
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium uppercase tracking-wide whitespace-nowrap',
        tone,
        className,
      ].join(' ')}
    >
      {meta.label}
    </span>
  )
}
