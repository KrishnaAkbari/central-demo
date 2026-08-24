'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { useIsOwner, useBillingVersion } from '@/stores/organizationStore'
import { useOrganizationStore } from '@/stores/organizationStore'
import { RestrictedAccess } from '@/components/billing/RestrictedAccess'
import { PersonaSwitcher } from '@/components/billing/PersonaSwitcher'
import { CurrentAccessCard } from '@/components/billing/CurrentAccessCard'
import { TrialCard } from '@/components/billing/TrialCard'
import { PlanCard } from '@/components/billing/PlanCard'
import { PlanMatrix } from '@/components/billing/PlanMatrix'
import { RecurringActions } from '@/components/billing/RecurringActions'
import { CancelPlanDialog } from '@/components/billing/CancelPlanDialog'
import { CheckoutReviewDialog } from '@/components/billing/CheckoutReviewDialog'
import { BillingCycleToggle } from '@/components/billing/BillingCycleToggle'
import { BillingViewToggle } from '@/components/billing/BillingViewToggle'
import {
  NORMAL_PLANS,
  RESTRUCTURED_PLANS,
  getActiveOrgBilling,
  getPlanForOrg,
  getWallet,
  getPlanDisabledReason,
  countActiveServers,
  startTrial,
  cancelRecurring,
  resumeRecurring,
  checkoutRecurring,
  getVisibleRecurringPlans,
  getCurrentPlanId,
  getCancellationImpact,
} from '@/services/billingApi'

// /billing/plans — recurring plan picker.
//
// Layout (top to bottom):
//   1. Header with Monthly/Yearly + Cards/Compare features toggles
//   2. CurrentAccessCard (lifetime banner if applicable, else plan + meta)
//   3. TrialCard (only if trial eligible / active / expired)
//   4. RecurringActions (only for paid recurring — Cancel/Resume strip)
//   5. Plan grid OR PlanMatrix — same data, two presentations.

const STORAGE_KEY_VIEW = 'cp_billing_plans_view'
const STORAGE_KEY_CYCLE = 'cp_billing_plans_cycle'

export default function BillingPlansPage() {
  const isOwner = useIsOwner()
  const router = useRouter()
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  const billingVersion = useBillingVersion()
  const [cycle, setCycle] = useState('monthly')
  const [view, setView] = useState('cards')
  const [vm, setVm] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [checkoutTarget, setCheckoutTarget] = useState(null) // plan object awaiting review
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  // Restore view + cycle preferences once on mount (avoids SSR mismatch).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const v = window.localStorage.getItem(STORAGE_KEY_VIEW)
      if (v === 'cards' || v === 'compare') setView(v)
    } catch {}
    try {
      const c = window.localStorage.getItem(STORAGE_KEY_CYCLE)
      if (c === 'monthly' || c === 'yearly') setCycle(c)
    } catch {}
  }, [])

  useEffect(() => {
    if (!activeOrgId) return
    const state = getActiveOrgBilling()
    const plan = getPlanForOrg(activeOrgId)
    const wallet = getWallet(activeOrgId)
    const serverCount = countActiveServers()
    setVm({ state, plan, wallet, serverCount })
  }, [activeOrgId, refreshKey, billingVersion])

  const refresh = () => setRefreshKey((k) => k + 1)

  const handleViewChange = (v) => {
    setView(v)
    try {
      window.localStorage.setItem(STORAGE_KEY_VIEW, v)
    } catch {}
  }

  const handleCycleChange = (c) => {
    setCycle(c)
    try {
      window.localStorage.setItem(STORAGE_KEY_CYCLE, c)
    } catch {}
  }

  const handleStartTrial = () => {
    startTrial()
    toast.success('Trial started — full plan access for the trial period.')
    refresh()
  }

  const handleCancel = () => {
    // Open the 2-step cancel dialog (impact + final confirm).
    // The dialog calls back to handleConfirmCancel via onConfirmCancel
    // when the user passes step 2.
    setCancelOpen(true)
  }

  const handleConfirmCancel = () => {
    cancelRecurring()
    toast.success('Plan canceled. Access continues until the end of the current period.')
    refresh()
  }

  const handleSwitchToFree = () => {
    const result = checkoutRecurring({ planId: 'free', useWallet: true })
    if (!result.ok) {
      toast.error('Could not switch to Free: ' + (result.reason || 'unknown'))
      return
    }
    if (result.walletApplied > 0) {
      toast.success(`Switched to Free — wallet credit applied.`)
    } else {
      toast.success('Switched to Free.')
    }
    refresh()
  }

  const handleResume = () => {
    resumeRecurring()
    toast.success('Plan resumed. Your subscription will renew on the next cycle.')
    refresh()
  }

  const handleChoosePlan = (planId) => {
    // Open the transparent review dialog (line items) instead of charging
    // immediately. CheckoutReviewDialog calls back via onConfirm.
    if (!vm?.state) return
    const target = catalog.find((p) => p.id === planId)
    if (!target) {
      toast.error('Plan not available.')
      return
    }
    setCheckoutTarget(target)
  }

  const handleConfirmCheckout = () => {
    if (!checkoutTarget) return
    setCheckoutLoading(true)
    const result = checkoutRecurring({ planId: checkoutTarget.id, useWallet: true })
    setCheckoutLoading(false)
    if (!result.ok) {
      toast.error('Could not switch plan: ' + (result.reason || 'unknown'))
      setCheckoutTarget(null)
      return
    }
    if (result.amountDue === 0 && result.walletApplied > 0) {
      toast.success(`Switched to ${checkoutTarget.name} — covered by wallet credit ($${result.walletApplied.toFixed(2)} applied).`)
    } else if (result.walletApplied > 0) {
      toast.success(`Switched to ${checkoutTarget.name}. $${result.walletApplied.toFixed(2)} wallet applied, $${result.amountDue.toFixed(2)} due today.`)
    } else if (result.amountDue === 0) {
      toast.success(`Switched to ${checkoutTarget.name}.`)
    } else {
      toast.success(`Switched to ${checkoutTarget.name}. $${result.amountDue.toFixed(2)} will be charged today.`)
    }
    setCheckoutTarget(null)
    refresh()
  }

  // Plan state derivation MUST be called before any conditional return
  // (React Rules of Hooks). The actual visibility of the picker is
  // controlled by the lifetime check below, but the memoization always
  // runs so it stays hook-safe.
  const state = vm?.state
  const plan = vm?.plan
  const wallet = vm?.wallet
  const serverCount = vm?.serverCount || 0
  // catalog is the full set of plans the user CAN see. When the
  // current subscription is Free, hide the Free card from the grid
  // (the CurrentAccessCard already shows "Free" prominently at the
  // top) so the picker stays a clean 4-up of paid tiers. Other tiers
  // (Newbie/Pro/Master/Business, or Managed/Self Managed for
  // restructured users) still need to be visible even when the user
  // is on them, so the current-tier cards stay in the grid for
  // upgrade/downgrade context.
  const catalog = (() => {
    const visible = state ? getVisibleRecurringPlans(state) : NORMAL_PLANS
    if (state?.planTier === 'free' && state.status === 'active') {
      return visible.filter((p) => p.id !== 'free')
    }
    return visible
  })()
  const currentTier = state ? getCurrentPlanId(state) : null

  const cardStates = useMemo(() => {
    if (!state) return {}
    const map = {}
    for (const p of catalog) {
      const reason = getPlanDisabledReason(p, state, serverCount)
      if (currentTier === p.id) {
        map[p.id] = { state: 'current', reason: null, tone: 'info' }
        continue
      }
      if (reason) {
        map[p.id] = { state: 'disabled', reason, tone: 'warning' }
        continue
      }
      // Downgrade if the plan is cheaper than the current one AND is
      // not Free. (Free downgrade is handled by disabled-reason.)
      if (currentTier && currentTier !== 'free' && p.priceUsd > 0 && p.priceUsd < (plan?.priceUsd ?? 0)) {
        map[p.id] = { state: 'downgrade', reason: null, tone: 'info' }
        continue
      }
      map[p.id] = { state: 'available', reason: null, tone: 'info' }
    }
    return map
  }, [catalog, currentTier, plan?.priceUsd, serverCount, state])

  // Per-plan disabled reasons for the matrix view. Mirrors the cards
  // view's getPlanDisabledReason() call so the matrix and cards show
  // the same lock state for the same plan. Only reasons (string) are
  // passed — the matrix uses their presence/absence to choose between
  // "Locked" and "Switch to X" CTAs. Per the round-7 changes,
  // getPlanDisabledReason now returns null for every recurring-picker
  // case except "Lifetime is active", and lifetime users hide the
  // matrix entirely at the page level, so in practice every non-current
  // plan renders "Switch to X" today.
  const matrixDisabledReasons = useMemo(() => {
    if (!state) return {}
    const map = {}
    for (const p of catalog) {
      if (currentTier === p.id) continue
      map[p.id] = getPlanDisabledReason(p, state, serverCount)
    }
    return map
  }, [catalog, currentTier, serverCount, state])

  if (!activeOrgId) return null
  if (!isOwner) return <RestrictedAccess />

  if (!vm) {
    return (
      <PageContainer>
        <PageHeader title="Plans" description="Pick a plan that fits your workload." />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </PageContainer>
    )
  }

  // Lifetime users see a redirect CTA in CurrentAccessCard instead of
  // the plan grid. Plans page is for recurring users — lifetime buyers
  // manage their deal on the Lifetime Deals tab.
  if (state.status === 'lifetime_active') {
    return (
      <PageContainer size="lg">
        <PageHeader
          title="Plans"
          description="Pick a plan that fits your workload."
        >
          <PersonaSwitcher onChange={refresh} />
        </PageHeader>
        <div className="mt-6 space-y-4">
          <CurrentAccessCard
            state={state}
            plan={plan}
            walletBalance={wallet.balance}
            serverCount={serverCount}
          />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            The recurring plan picker is hidden for lifetime deals. Manage your deal in the Lifetime Deals section.
          </p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer size="lg">
      <PageHeader
        title="Plans"
        description="Pick a plan that fits your workload."
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <BillingCycleToggle value={cycle} onChange={handleCycleChange} />
          <BillingViewToggle value={view} onChange={handleViewChange} />
          <PersonaSwitcher onChange={refresh} />
        </div>
      </PageHeader>

      <div className="mt-6 space-y-5">
        {/* Current access */}
        <CurrentAccessCard
          state={state}
          plan={plan}
          walletBalance={wallet.balance}
          serverCount={serverCount}
        />

        {/* Trial lifecycle */}
        <TrialCard
          state={state.trialState}
          trialExpiresAt={state.trialExpiresAt}
          onStartTrial={handleStartTrial}
        />

        {/* Cancel / Resume for paid recurring */}
        <RecurringActions
          state={state}
          currentPeriodEnd={state.currentPeriodEnd}
          onCancel={handleCancel}
          onResume={handleResume}
        />

        {/* Plan picker — cards or compare-features view. Grid cols:
            mobile 1 / md 2 / xl 4 so each paid tier sits next to its
            neighbors at full layout width and stacks 2x2 below lg. The
            Free plan (when current sub is Free) renders into the same
            row — the popular-plan badge in the middle breaks the row
            visually so 5 cards in one row still reads as a hierarchy. */}
        {view === 'cards' ? (
          <div id="plan-grid" tabIndex={-1} className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            {catalog.map((p) => {
              const info = cardStates[p.id] || { state: 'available', reason: null, tone: 'info' }
              return (
                <PlanCard
                  key={p.id}
                  plan={p}
                  state={info.state}
                  disabledReason={info.reason}
                  disabledReasonTone={info.tone}
                  cycle={cycle}
                  onSelect={handleChoosePlan}
                  isPopular={p.popular}
                  currentTier={currentTier}
                />
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 sm:p-4">
            <PlanMatrix
              plans={catalog}
              cycle={cycle}
              onChoose={handleChoosePlan}
              disabledReasonLookup={{
                current: currentTier,
                byPlan: matrixDisabledReasons,
              }}
            />
          </div>
        )}
      </div>

      {/* 2-step cancel flow dialog. impact is computed only when the
          dialog is about to open (state/plan must exist). */}
      <CancelPlanDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        state={state}
        plan={plan}
        impact={
          cancelOpen && state && plan && wallet
            ? getCancellationImpact(state, plan, serverCount, wallet.balance)
            : null
        }
        onSwitchToFree={handleSwitchToFree}
        onConfirmCancel={handleConfirmCancel}
      />

      {/* Transparent checkout review dialog — shows line breakdown before charging. */}
      <CheckoutReviewDialog
        open={!!checkoutTarget}
        onOpenChange={(o) => { if (!o) setCheckoutTarget(null) }}
        plan={checkoutTarget}
        currentPlan={plan}
        serverCount={vm?.serverCount || 0}
        walletBalance={wallet?.balance || 0}
        loading={checkoutLoading}
        onConfirm={handleConfirmCheckout}
      />
    </PageContainer>
  )
}