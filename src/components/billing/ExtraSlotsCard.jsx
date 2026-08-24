'use client'

import { useState } from 'react'
import { Plus, Minus, Server, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  read,
  write,
  KEYS,
  appendTransaction,
  setWalletBalance,
  getActiveOrgId,
} from '@/services/billingApi'

// ExtraSlotsCard — shown only for lifetime users on a tier with a slot
// limit (Newbie/Pro/Master). The card lets them add more server slots
// at the per-slot price; each click adds 1 slot, decrements wallet
// (or charges remainder), and appends a transaction. Calls onChange
// so the parent can re-pull the latest view model.
//
// Business lifetime is unlimited → this card is hidden.
//
// For a pure prototype, the slot increment is optimistic + a direct
// state mutation. No checkout dialog in Round 3a — full checkout
// lands in Round 3b.
export function ExtraSlotsCard({ state, plan, walletBalance, onChange }) {
  const [pending, setPending] = useState(false)

  if (!plan || plan.serverLimit === null) return null
  if (!state?.extraSlotPriceUsd && !plan.extraSlotPriceUsd) return null
  const pricePer = plan.extraSlotPriceUsd
  const slotsOwned = state.lifetimeServersLimit ?? plan.serverLimit
  const inUse = state.lifetimeSlotsInUse ?? 0

  const handleAdd = async () => {
    if (pending) return
    setPending(true)
    // Optimistic local update (mock)
    try {
      const next = slotsOwned + 1
      const w = walletBalance
      const applied = Math.min(w, pricePer)
      const due = Math.max(0, pricePer - applied)
      // Read current state and update via a tiny inline mutation. The
      // billing API doesn't yet expose a "buy slot" helper, so we
      // do the lazy thing for the prototype: write the new limit and
      // append a transaction via the helpers we already have.
      const orgId = getActiveOrgId()
      if (!orgId) return
      const map = read(KEYS.BILLING, {})
      const cur = map[orgId] || {}
      map[orgId] = { ...cur, lifetimeServersLimit: next }
      write(KEYS.BILLING, map)
      if (applied > 0) setWalletBalance(orgId, w - applied)
      appendTransaction(orgId, {
        type: 'extra_slot',
        amount: pricePer,
        description: `Extra server slot — ${plan.name}`,
        walletApplied: applied,
        amountDue: due,
      })
      toast.success(`Added 1 server slot ($${pricePer}). ${applied > 0 ? `Wallet $${applied.toFixed(2)} applied, $${due.toFixed(2)} due.` : `$${due.toFixed(2)} will be charged.`}`)
      if (onChange) onChange()
    } catch (e) {
      toast.error('Could not add slot: ' + e.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="p-5 border-indigo-200 dark:border-indigo-500/40 bg-gradient-to-br from-indigo-50/60 via-white to-white dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-500/20 shrink-0">
            <Server className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Server slots
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              You have <strong className="text-slate-900 dark:text-white">{slotsOwned}</strong> server slots
              {inUse > 0 && <> ({inUse} in use)</>}.
              Add more for <strong className="text-slate-900 dark:text-white">${pricePer}</strong> each.
            </p>
          </div>
        </div>
        <Button type="button" onClick={handleAdd} disabled={pending} className="shrink-0">
          <Plus className="h-4 w-4" />
          {pending ? 'Adding…' : `Add 1 slot ($${pricePer})`}
        </Button>
      </div>
    </Card>
  )
}