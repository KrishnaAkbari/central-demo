// Billing math helpers — single source of truth for any calculation
// that depends on how a transaction's `amount` and `walletApplied`
// fields interact. Both /billing/wallet and /billing/overview import
// this; if a new tx type is ever added, update this one function and
// both pages pick it up.
//
// Reference: per-tx-type reasoning captured in memory/2026-07-17.md
// (R40 entry — "Treat mock billing fields as a schema, not as math").
// Raw `tx.amount` is the gross charge (correct for invoices), not the
// wallet delta. A renewal that touched wallet has `walletApplied > 0`
// and the wallet delta is `-walletApplied`; a renewal paid entirely
// from card has `walletApplied: 0` and no wallet impact at all.

export function balanceDelta(t) {
  if (!t) return 0
  const amount = Number(t.amount) || 0
  const walletApplied = Number(t.walletApplied) || 0
  switch (t.type) {
    case 'credit_added':
    case 'refund':
      return amount
    case 'wallet_debit':
      return -amount
    case 'plan_renewal':
    case 'lifetime_purchase':
      return -walletApplied
    case 'extra_slot':
    case 'recurring':
      // Recurring/extra-slot transactions only debit wallet in the
      // mock (no card path), so walletApplied is the full amount.
      return walletApplied > 0 ? -walletApplied : -amount
    default:
      return 0
  }
}

// Helpers built on balanceDelta. Used by wallet stats and overview
// metrics so both surfaces agree on "what does this number mean".

export function sumThisMonthNet(txs, now = new Date()) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return txs.reduce((sum, t) => {
    const ts = t?.createdAt ? new Date(t.createdAt).getTime() : 0
    if (ts >= startOfMonth) return sum + balanceDelta(t)
    return sum
  }, 0)
}

export function sumLifetimeSpent(txs) {
  return txs.reduce((sum, t) => {
    const delta = balanceDelta(t)
    return delta < 0 ? sum + Math.abs(delta) : sum
  }, 0)
}
