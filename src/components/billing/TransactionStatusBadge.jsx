'use client'

import { TONE_CLASSES, getTxStatusMeta } from './transactionLabels'

// Pill that shows a transaction status (completed/pending/failed/refunded).
export function TransactionStatusBadge({ status, className = '' }) {
  const meta = getTxStatusMeta(status)
  const tone = TONE_CLASSES[meta.tone] || TONE_CLASSES.slate
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium whitespace-nowrap',
        tone,
        className,
      ].join(' ')}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {meta.label}
    </span>
  )
}
