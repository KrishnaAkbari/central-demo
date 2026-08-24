'use client'

import { useMemo } from 'react'
import { Receipt, ArrowRight, Wallet, AlertTriangle, Server as ServerIcon, Minus } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getPlanSwitchDiff } from '@/services/billingApi'

// CheckoutReviewDialog — transparent line-item preview before charging.
//
// Renders BEFORE checkoutRecurring() runs. The parent computes the
// breakdown (plan price, wallet credit, amount due, next renewal date)
// and passes it in. Confirm calls onConfirm which actually charges.
//
// Round 7: when the target plan is a downgrade (cheaper than current),
// the dialog adds an "impact" block above the line items that lists
// what the user loses (using getPlanSwitchDiff), plus a server-overhang
// warning if the user's current server count exceeds the target plan's
// serverLimit. Confirm button switches to warning tone for downgrades so
// the destructive action is visually distinct from upgrades.
//
// Pattern (Stripe checkout / Linear / Vercel billing summary):
//   1. Downgrade impact block (when applicable)
//   2. Plan price line
//   3. Wallet credit line (only if > 0)
//   4. Subtotal + amount due (large, emphasized)
//   5. Next renewal date
//   6. Confirm (primary) + Cancel (outline)
export function CheckoutReviewDialog({
  open,
  onOpenChange,
  plan,
  currentPlan,
  serverCount = 0,
  walletBalance,
  useWallet = true,
  loading = false,
  onConfirm,
}) {
  const breakdown = useMemo(() => {
    if (!plan) return null
    const basePrice = plan.priceUsd || 0
    const walletApplied = useWallet && basePrice > 0 ? Math.min(walletBalance, basePrice) : 0
    const amountDue = Math.max(0, basePrice - walletApplied)
    const nextRenewal = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    return {
      basePrice,
      walletApplied,
      amountDue,
      nextRenewal: nextRenewal.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    }
  }, [plan, walletBalance, useWallet])

  // Round 7: downgrade detection + impact diff + server overhang.
  const downgradeInfo = useMemo(() => {
    if (!plan || !currentPlan) return null
    if (currentPlan.id === plan.id) return null
    if (currentPlan.priceUsd <= 0) return null // from Free has no "downgrade"
    if (plan.priceUsd >= currentPlan.priceUsd) return null
    if (plan.priceUsd === 0) return null // to Free goes through CancelPlanDialog, not here
    const diff = getPlanSwitchDiff(currentPlan.id, plan.id)
    if (!diff) return null
    const losses = diff.categories.flatMap((c) => c.rows.filter((r) => r.direction === 'loss'))
    const newLimit = plan.serverLimit
    const overhang = newLimit != null && serverCount > newLimit
      ? serverCount - newLimit
      : 0
    return { diff, losses, overhang, newLimit }
  }, [plan, currentPlan, serverCount])

  if (!plan || !breakdown) return null
  const isFree = breakdown.basePrice === 0
  const isCovered = breakdown.amountDue === 0 && breakdown.walletApplied > 0
  const isDowngrade = !!downgradeInfo

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        header={
          <div className="flex items-start gap-3 px-6 py-5 border-b border-slate-200 dark:border-slate-800">
            <div
              data-testid="checkout-header-icon"
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl shrink-0',
                isDowngrade
                  ? 'bg-amber-100 dark:bg-amber-500/20'
                  : 'bg-indigo-100 dark:bg-indigo-500/20',
              )}
            >
              {isDowngrade
                ? <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                : <Receipt className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              }
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Confirm switch to {plan.name}
              </h2>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                {isDowngrade
                  ? <>You're moving from <span className="font-medium">{currentPlan?.name}</span> to {plan.name}. Review what changes below.</>
                  : 'Review the breakdown below before confirming.'}
              </p>
            </div>
          </div>
        }
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              data-testid="checkout-cancel"
            >
              Never mind
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              data-testid="checkout-confirm"
              className={cn(
                isDowngrade && 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 dark:bg-amber-500 dark:hover:bg-amber-600 dark:border-amber-500'
              )}
            >
              {loading ? 'Switching…' : (
                isFree
                  ? 'Switch to Free'
                  : isCovered
                    ? 'Apply wallet credit'
                    : isDowngrade
                      ? `Downgrade to ${plan.name}`
                      : `Confirm — charge $${breakdown.amountDue.toFixed(2)}`
              )}
              {!loading && <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 px-6 py-5">
          {/* Round 7: downgrade impact block. Renders above the line items
              so the user sees what they're losing before they see what
              they pay. Only shown when target is cheaper than current. */}
          {isDowngrade && downgradeInfo && (
            <div
              data-testid="checkout-impact"
              className="rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-500/10 p-3"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  What you'll lose when you downgrade
                </p>
              </div>
              {downgradeInfo.losses.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {downgradeInfo.losses.map((row) => (
                    <li
                      key={row.rowId}
                      data-testid="checkout-impact-row"
                      className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200"
                    >
                      <Minus className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="flex-1 min-w-0">
                        <span className="font-medium">{row.label}:</span>{' '}
                        <span className="line-through tabular-nums text-amber-700/70 dark:text-amber-300/70">
                          {formatRowVal(row, row.from)}
                        </span>
                        {' '}
                        &rarr;{' '}
                        <span className="font-medium tabular-nums">
                          {formatRowVal(row, row.to)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                  You'll keep all current features but pay less each month.
                </p>
              )}
              {/* Server overhang: the killer edge case. If the user has
                  more servers connected than the new plan allows, the
                  extras will be disconnected or fail to sync. Surface
                  this BEFORE confirm — recoverable only by manual cleanup. */}
              {downgradeInfo.overhang > 0 && (
                <div
                  data-testid="checkout-overhang"
                  className="mt-3 rounded-md border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 p-2.5 flex items-start gap-2"
                >
                  <ServerIcon className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-900 dark:text-red-100">
                    <span className="font-semibold">Heads up:</span> you have{' '}
                    <span className="font-semibold">{serverCount} servers</span> connected
                    but {plan.name} only allows{' '}
                    <span className="font-semibold">{downgradeInfo.newLimit}</span>.
                    {' '}
                    {downgradeInfo.overhang} server{downgradeInfo.overhang === 1 ? '' : 's'} will lose access
                    until you disconnect {downgradeInfo.overhang === 1 ? 'it' : 'them'}.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Line items */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {/* Plan line */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {plan.name} plan
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isDowngrade && currentPlan
                    ? <>Downgrade from <span className="font-medium">{currentPlan.name}</span> ({currentPlan.priceUsd > 0 ? `$${currentPlan.priceUsd.toFixed(2)}/mo` : 'Free'})</>
                    : 'Billed monthly'}
                </p>
              </div>
              <p
                data-testid="checkout-line-plan"
                className="text-sm font-medium tabular-nums text-slate-900 dark:text-white"
              >
                {isFree ? 'Free' : `$${breakdown.basePrice.toFixed(2)}`}
              </p>
            </div>

            {/* Wallet credit line */}
            {breakdown.walletApplied > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-emerald-50/40 dark:bg-emerald-500/5">
                <div className="flex items-center gap-2 min-w-0">
                  <Wallet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Wallet credit applied
                  </p>
                </div>
                <p
                  data-testid="checkout-line-wallet"
                  className="text-sm font-medium tabular-nums text-emerald-700 dark:text-emerald-300"
                >
                  −${breakdown.walletApplied.toFixed(2)}
                </p>
              </div>
            )}

            {/* Subtotal */}
            <div
              className={cn(
                'flex items-center justify-between px-4 py-3',
                !isFree && 'bg-slate-50 dark:bg-slate-800/40',
              )}
            >
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {isFree ? 'Total due today' : 'Amount due today'}
              </p>
              <p
                data-testid="checkout-amount-due"
                className={cn(
                  'text-base font-semibold tabular-nums',
                  isCovered
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-900 dark:text-white',
                )}
              >
                {isFree ? '$0.00' : `$${breakdown.amountDue.toFixed(2)}`}
              </p>
            </div>
          </div>

          {/* Next renewal callout */}
          {!isFree && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Your next charge will be on{' '}
              <span data-testid="checkout-next-renewal" className="font-medium text-slate-900 dark:text-white">
                {breakdown.nextRenewal}
              </span>{' '}
              for ${breakdown.basePrice.toFixed(2)}. You can cancel or downgrade anytime before then.
            </p>
          )}
          {isFree && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              You'll keep wallet credit. You can upgrade to a paid plan anytime.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function formatRowVal(row, val) {
  if (val == null) return '—'
  if (row.kind === 'bool') return val ? 'Included' : 'Not included'
  if (row.kind === 'price') {
    const n = Number(val)
    if (!n) return '—'
    return `$${n.toFixed(2)}/slot`
  }
  return String(val)
}
