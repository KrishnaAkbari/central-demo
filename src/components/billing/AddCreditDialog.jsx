'use client'

import { useState } from 'react'
import { CreditCard, Wallet, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { getDefaultCard, CARD_BRANDS } from '@/services/billingPaymentMethodsApi'
import { useEffect } from 'react'

// Quick top-up amounts. $5 / $10 / $25 / $50 / $100 are common presets
// across wallet products (Stripe Treasury, PayPal Wallet, Cash App).
// Custom amount is allowed up to $5000 per single add.
const PRESETS = [5, 10, 25, 50, 100]
const MIN_AMOUNT = 1
const MAX_AMOUNT = 5000

export function AddCreditDialog({ open, onOpenChange, currentBalance = 0, onAdded }) {
  const [selected, setSelected] = useState(25)
  const [custom, setCustom] = useState('')
  const [pending, setPending] = useState(false)
  // The default card on file is read live so the footer copy tracks the
  // user's actual chosen default (e.g. ends in 4242 or 4444).
  const [defaultCard, setDefaultCard] = useState(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    setDefaultCard(getDefaultCard())
    function onChange() { setDefaultCard(getDefaultCard()) }
    window.addEventListener('billing:state-changed', onChange)
    return () => window.removeEventListener('billing:state-changed', onChange)
  }, [open])

  const customNum = custom === '' ? null : Number(custom)
  const usingCustom = custom !== ''
  const amount = usingCustom ? customNum : selected

  const valid =
    amount !== null &&
    !Number.isNaN(amount) &&
    amount >= MIN_AMOUNT &&
    amount <= MAX_AMOUNT

  const handleAdd = async (e) => {
    e?.preventDefault?.()
    if (!valid || pending) return
    setPending(true)
    // Simulate a network round-trip to a payment processor (mock).
    await new Promise((r) => setTimeout(r, 600))
    setPending(false)
    onAdded?.(amount)
    toast.success(`Added $${amount.toFixed(2)} to wallet. New balance: $${(currentBalance + amount).toFixed(2)}.`)
    onOpenChange(false)
    setCustom('')
    setSelected(25)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={handleAdd}>
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15">
                <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <DialogTitle>Add credit to wallet</DialogTitle>
                <DialogDescription>
                  Pay with a card on file. Mock checkout — no real charge.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-5">
            {/* Preset amounts */}
            <div>
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Quick top-up
              </Label>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {PRESETS.map((p) => {
                  const isActive = !usingCustom && selected === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setSelected(p)
                        setCustom('')
                      }}
                      className={[
                        'rounded-md border px-2 py-2.5 text-sm font-medium transition',
                        isActive
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600',
                      ].join(' ')}
                    >
                      ${p}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom amount */}
            <div>
              <Label htmlFor="custom-amount" className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Custom amount
              </Label>
              <div className="mt-2 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400">
                  $
                </span>
                <Input
                  id="custom-amount"
                  type="number"
                  inputMode="decimal"
                  min={MIN_AMOUNT}
                  max={MAX_AMOUNT}
                  step="0.01"
                  placeholder="0.00"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  className="pl-7"
                />
              </div>
              <p className="mt-1 text-2xs text-slate-500 dark:text-slate-400">
                Between ${MIN_AMOUNT} and ${MAX_AMOUNT.toLocaleString()}.
              </p>
            </div>

            {/* Summary line */}
            <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">Current balance</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  ${currentBalance.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">
                  Adding {valid ? `$${amount.toFixed(2)}` : '—'}
                </span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {valid ? `+$${amount.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  New balance
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {valid ? `$${(currentBalance + amount).toFixed(2)}` : '—'}
                </span>
              </div>
            </div>

            {/* Default payment method footer — reads from saved cards store. */}
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <CreditCard className="h-3.5 w-3.5" />
              {defaultCard ? (
                <span>
                  Charging{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {CARD_BRANDS[defaultCard.brand]?.label || 'card'}
                  </span>{' '}
                  ending in ••••{' '}
                  <span className="tabular-nums">{defaultCard.last4}</span>.
                </span>
              ) : (
                <span>
                  No default card on file. Add one in Payment Methods to use
                  card billing.
                </span>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {pending ? (
                'Adding…'
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Add {valid ? `$${amount.toFixed(2)}` : 'credit'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
