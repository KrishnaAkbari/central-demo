'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Minus, AlertTriangle, Wallet, CalendarClock, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getCancellationReasons } from '@/services/billingApi'

// CancelPlanDialog — 2-step cancellation modal for paid recurring plans.
//
// Step 1 (default): "What you'll lose" screen with retention offer +
// reason capture. User can pivot to free, switch to a different plan,
// or continue down the cancel path.
//
// Step 2: Final destructive confirm. Only reachable if the user
// explicitly chose a reason and clicked "Cancel plan" in step 1.
//
// Step 1 is dismissed by clicking "Keep plan", the X, or pressing Esc.
// Step 2 is a separate ConfirmDialog inside this component.
//
// Helper data:
//   `getCancellationImpact(state, plan, serverCount, walletBalance)`
//   returns: { isLegacy, planName, planPriceUsd, periodEnd,
//              categories: [{category, changes: [{rowId,label,kind,
//              current,after}]}], serverOverhang, walletBalance }
//   Categories with no diff are collapsed by the helper.
//
//   `getCancellationReasons()` returns 6 reason options.
//
// Reason capture persists to `cp_cancellation_feedback` localStorage
// (newest first, capped at 50 entries). Field is best-effort: reason
// selection is required to proceed to step 2, the textarea is optional.
//
// Accessibility:
//   - Dialog title + description for screen readers.
//   - Reason radios are real <input type="radio"> inside <label>
//     (native keyboard nav, no custom focus management needed).
//   - Step 2 destructive confirm uses the standard confirm-dialog
//     pattern (focus trap via Radix Dialog primitive).
//   - Esc closes step 1 (and step 2 if open).

const FEEDBACK_KEY = 'cp_cancellation_feedback'
const FEEDBACK_CAP = 50

function fmtUsd(n) {
  return `$${(Number(n) || 0).toFixed(2)}`
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Render one diff cell value (matches PlanMatrix.renderCell style so
// the "what you'll lose" rows feel native to the rest of /billing).
function renderValue(value, kind) {
  if (kind === 'bool') {
    if (value === true) {
      return <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="Included" />
    }
    return <Minus className="h-4 w-4 text-slate-300 dark:text-slate-600" aria-label="Not included" />
  }
  if (kind === 'price') {
    if (!value) return <Minus className="h-4 w-4 text-slate-300 dark:text-slate-600" aria-label="Not available" />
    return <span className="font-medium text-slate-700 dark:text-slate-200 tabular-nums">${value}/mo</span>
  }
  return <span className="text-slate-700 dark:text-slate-200">{String(value)}</span>
}

export function CancelPlanDialog({
  open,
  onOpenChange,
  state,
  plan,
  impact, // pre-computed via getCancellationImpact(state, plan, serverCount, walletBalance)
  onSwitchToFree,
  onConfirmCancel,
}) {
  const reasons = useMemo(() => getCancellationReasons(), [])
  const [reasonId, setReasonId] = useState('')
  const [reasonNote, setReasonNote] = useState('')
  const [step, setStep] = useState(1) // 1 = impact, 2 = final confirm

  // Reset local state whenever the dialog closes (or reopens for a
  // different plan). Avoids stale reason selection across cancellations.
  useEffect(() => {
    if (!open) {
      setReasonId('')
      setReasonNote('')
      setStep(1)
    }
  }, [open])

  // If impact changes while open (rare — persona switch), reset to step 1.
  useEffect(() => {
    if (open) setStep(1)
  }, [impact, open])

  if (!impact || !plan) return null

  const { isLegacy, planName, periodEnd, categories, serverOverhang, walletBalance } = impact

  const canProceedToStep2 = reasonId.length > 0

  const handleProceedToConfirm = () => {
    if (!canProceedToStep2) return
    // Persist the reason immediately (so even if step 2 is dismissed
    // we capture the feedback signal).
    appendFeedback({
      planId: plan.id,
      planName: plan.name,
      reason: reasonId,
      note: reasonNote.trim() || null,
      at: new Date().toISOString(),
    })
    setStep(2)
  }

  const handleFinalCancel = () => {
    onConfirmCancel?.()
    onOpenChange?.(false)
  }

  const handleSwitchToFree = () => {
    onSwitchToFree?.()
    onOpenChange?.(false)
  }

  const showServerOverhang = serverOverhang > 0
  const showWallet = Number(walletBalance) > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        className="border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-0 gap-0 overflow-hidden"
      >
        {step === 1 ? (
          <>
            <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5 pr-7">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <X className="h-5 w-5" />
                </div>
                <DialogTitle className="text-slate-900 dark:text-white text-base font-semibold leading-tight">
                  Cancel {planName}?
                </DialogTitle>
              </div>
              <DialogDescription className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-snug">
                Your access continues until {fmtDate(periodEnd)}, then your org moves to Free.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-5 space-y-5 text-sm text-slate-700 dark:text-slate-200 max-h-[60vh] overflow-y-auto">
              {/* Server overhang callout — amber banner */}
              {showServerOverhang && (
                <div
                  data-testid="cancel-overhang-callout"
                  className="flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-amber-900 dark:text-amber-100"
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-sm">
                      {serverOverhang} server{serverOverhang === 1 ? '' : 's'} will be paused
                    </p>
                    <p className="text-xs mt-0.5 text-amber-800/90 dark:text-amber-200/80">
                      Free allows 1 server. The others will be paused on {fmtDate(periodEnd)} and can be resumed if you upgrade later.
                    </p>
                  </div>
                </div>
              )}

              {/* Wallet reminder */}
              {showWallet && (
                <div
                  data-testid="cancel-wallet-note"
                  className="flex items-start gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-slate-700 dark:text-slate-300"
                >
                  <Wallet className="h-4 w-4 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
                  <p className="text-xs">
                    Your wallet balance of <span className="font-semibold tabular-nums">{fmtUsd(walletBalance)}</span> is preserved and can be used when you upgrade.
                  </p>
                </div>
              )}

              {/* What you'll lose */}
              <section data-testid="cancel-impact-section">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                  What you'll lose on Free
                </h3>

                {isLegacy ? (
                  <div
                    data-testid="cancel-legacy-fallback"
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-3 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <p>
                      Your original Legacy plan features end on {fmtDate(periodEnd)}.
                      Reactivating later will offer standard pricing — your legacy discount will not be restored.
                    </p>
                  </div>
                ) : categories.length === 0 ? (
                  <div
                    data-testid="cancel-impact-empty"
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-3 text-sm text-slate-600 dark:text-slate-300"
                  >
                    No measurable feature difference for your current usage.
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden">
                    {categories.map((cat) => (
                      <div key={cat.category} data-testid={`cancel-impact-category-${cat.category}`}>
                        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {cat.category}
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {cat.changes.map((c) => (
                            <div
                              key={c.rowId}
                              data-testid={`cancel-impact-row-${c.rowId}`}
                              className="flex items-center gap-3 px-3 py-2 text-sm"
                            >
                              <span className="flex-1 text-slate-700 dark:text-slate-300">{c.label}</span>
                              <span
                                className="line-through text-slate-400 dark:text-slate-500 tabular-nums"
                                data-testid={`cancel-impact-current-${c.rowId}`}
                              >
                                {renderValue(c.current, c.kind)}
                              </span>
                              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                              <span
                                className="text-slate-900 dark:text-white min-w-[60px] text-right"
                                data-testid={`cancel-impact-after-${c.rowId}`}
                              >
                                {renderValue(c.after, c.kind)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Reason capture */}
              <section data-testid="cancel-reason-section">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                  Why are you canceling?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5" role="radiogroup" aria-label="Cancellation reason">
                  {reasons.map((r) => {
                    const checked = reasonId === r.id
                    return (
                      <label
                        key={r.id}
                        data-testid={`cancel-reason-${r.id}`}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors text-sm',
                          checked
                            ? 'border-indigo-300 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-100'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                        )}
                      >
                        <input
                          type="radio"
                          name="cp-cancel-reason"
                          value={r.id}
                          checked={checked}
                          onChange={() => setReasonId(r.id)}
                          className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600"
                        />
                        <span>{r.label}</span>
                      </label>
                    )
                  })}
                </div>

                <textarea
                  data-testid="cancel-reason-note"
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Anything else you'd like us to know? (optional)"
                  className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </section>
            </div>

            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange?.(false)}
                  data-testid="cancel-keep-plan"
                >
                  Keep plan
                </Button>
                {onSwitchToFree && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSwitchToFree}
                    data-testid="cancel-switch-to-free"
                    className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                  >
                    Switch to Free now
                  </Button>
                )}
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={handleProceedToConfirm}
                disabled={!canProceedToStep2}
                data-testid="cancel-proceed"
              >
                Cancel plan
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2 — final destructive confirm */}
            <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5 pr-7">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <DialogTitle className="text-slate-900 dark:text-white text-base font-semibold leading-tight">
                  Cancel subscription?
                </DialogTitle>
              </div>
              <DialogDescription className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-snug">
                This is the last step. You can still resume your plan anytime before {fmtDate(periodEnd)}.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-5 space-y-4 text-sm text-slate-700 dark:text-slate-200">
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-3">
                <CalendarClock className="h-4 w-4 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
                <div className="text-xs">
                  <p className="text-slate-700 dark:text-slate-200">
                    Access to <span className="font-semibold">{planName}</span> continues until <span className="font-semibold tabular-nums">{fmtDate(periodEnd)}</span>.
                  </p>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    After that, your org moves to Free and the changes listed above take effect.
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400">
                Recorded reason: <span className="font-medium text-slate-700 dark:text-slate-200">{reasons.find((r) => r.id === reasonId)?.label || reasonId}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                data-testid="cancel-final-back"
                disabled={false}
              >
                Never mind
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleFinalCancel}
                data-testid="cancel-final-confirm"
              >
                Yes, cancel subscription
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Local feedback persistence. Best-effort — never throws, just caps to
// FEEDBACK_CAP newest entries. Key is shared across all personas so the
// future admin view can summarize churn reasons.
// ---------------------------------------------------------------------------
function appendFeedback(entry) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(FEEDBACK_KEY)
    const list = raw ? JSON.parse(raw) : []
    list.unshift(entry)
    while (list.length > FEEDBACK_CAP) list.pop()
    window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list))
  } catch {
    // Ignore — localStorage may be unavailable (private mode).
  }
}