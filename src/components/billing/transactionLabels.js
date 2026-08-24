'use client'

// Transaction type metadata. Keeps UI strings + tone consistent across
// the Wallet (recent activity) and Transactions (table) pages so the
// same row never renders differently in two places.
export const TX_TYPE_META = {
  plan_renewal: {
    label: 'Recurring plan',
    tone: 'sky',
    icon: 'autorenew',
  },
  trial_start: {
    label: 'Trial started',
    tone: 'sky',
    icon: 'play',
  },
  trial_end: {
    label: 'Trial ended',
    tone: 'slate',
    icon: 'stop',
  },
  plan_canceled: {
    label: 'Plan canceled',
    tone: 'slate',
    icon: 'x-circle',
  },
  lifetime_purchase: {
    label: 'Lifetime deal',
    tone: 'amber',
    icon: 'crown',
  },
  extra_slot: {
    label: 'Extra slot',
    tone: 'indigo',
    icon: 'plus-circle',
  },
  credit_added: {
    label: 'Wallet credit added',
    tone: 'emerald',
    icon: 'plus',
  },
  wallet_debit: {
    label: 'Wallet debit',
    tone: 'slate',
    icon: 'minus',
  },
  refund: {
    label: 'Refund',
    tone: 'emerald',
    icon: 'undo',
  },
}

export function getTxTypeMeta(type) {
  return TX_TYPE_META[type] || {
    label: type ? type.replace(/_/g, ' ') : 'Transaction',
    tone: 'slate',
    icon: 'circle',
  }
}

// Tone classes for small inline badges. Keys match `tone` above plus a
// neutral default so callers can pass anything safely.
export const TONE_CLASSES = {
  sky: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
  slate: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:border-slate-600',
  rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
}

// Friendly date format: "Jun 12, 2026 — 2:31 PM"
export function formatTxDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Compact date format for tables: "Jun 12, 2026" + separate time column.
export function formatTxDateShort(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTxTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatUsd(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0.00'
  return `$${n.toFixed(2)}`
}

// Filter chip buckets. Each group includes a category label + the list of
// transaction types that roll up into it. The Transactions table uses these
// to power its filter chip row.
export const TX_FILTER_GROUPS = [
  { id: 'all', label: 'All', types: null },
  {
    id: 'recurring',
    label: 'Recurring',
    types: ['plan_renewal', 'plan_canceled'],
  },
  {
    id: 'lifetime',
    label: 'Lifetime',
    types: ['lifetime_purchase'],
  },
  {
    id: 'wallet',
    label: 'Wallet',
    types: ['credit_added', 'wallet_debit', 'extra_slot', 'refund'],
  },
  {
    id: 'trial',
    label: 'Trial',
    types: ['trial_start', 'trial_end'],
  },
]

// Transaction status metadata. Status pill tone by status value.
export const TX_STATUS_META = {
  completed: { label: 'Completed', tone: 'emerald' },
  pending: { label: 'Pending', tone: 'amber' },
  failed: { label: 'Failed', tone: 'rose' },
  refunded: { label: 'Refunded', tone: 'sky' },
}

export function getTxStatusMeta(status) {
  return TX_STATUS_META[status] || { label: status || 'Unknown', tone: 'slate' }
}
