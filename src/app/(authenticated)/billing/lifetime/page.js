'use client'

import { useEffect, useMemo, useState } from 'react'
import { Crown, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { useIsOwner, useBillingVersion } from '@/stores/organizationStore'
import { useOrganizationStore } from '@/stores/organizationStore'
import { RestrictedAccess } from '@/components/billing/RestrictedAccess'
import { PersonaSwitcher } from '@/components/billing/PersonaSwitcher'
import { LifetimeCard } from '@/components/billing/LifetimeCard'
import { ExtraSlotsCard } from '@/components/billing/ExtraSlotsCard'
import {
  TRADITIONAL_LIFETIME,
  RESTRUCTURED_LIFETIME,
  getActiveOrgBilling,
  getPlanForOrg,
  getWallet,
  checkoutLifetime,
} from '@/services/billingApi'

// /billing/lifetime — lifetime deals page.
//
// Lifecycle (driven by getActiveOrgBilling() + getPlanForOrg):
//   1. No lifetime yet, on Free / Trial / paid recurring:
//      show the full lifetime catalog. Lower-tier-than-current deals
//      show a "Cannot downgrade" disabled state. User picks one to buy.
//   2. Already on a lifetime (lifetime_active):
//      show "Your lifetime deal" card pinned, and ONLY higher tiers
//      (upgrade path) below. ExtraSlotsCard shown for slot-limited
//      tiers. Business lifetime shows the "no further upgrade" banner.
//   3. Legacy grandfathered: lifetime section hidden, normal plans.
export default function BillingLifetimePage() {
  const isOwner = useIsOwner()
  const billingVersion = useBillingVersion()
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  const [vm, setVm] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!activeOrgId) return
    const state = getActiveOrgBilling()
    const plan = getPlanForOrg(activeOrgId)
    const wallet = getWallet(activeOrgId)
    setVm({ state, plan, wallet })
  }, [activeOrgId, refreshKey, billingVersion])

  const refresh = () => setRefreshKey((k) => k + 1)

  const handleBuy = (tierId) => {
    if (!vm?.state) return
    const result = checkoutLifetime({ tierId, useWallet: true })
    if (!result.ok) {
      toast.error('Could not buy lifetime: ' + (result.reason || 'unknown'))
      return
    }
    const parts = []
    if (result.walletApplied > 0) parts.push(`$${result.walletApplied.toFixed(2)} wallet applied`)
    if (result.existingCredit > 0) parts.push(`$${result.existingCredit.toLocaleString()} lifetime credit applied`)
    if (result.amountDue > 0) parts.push(`$${result.amountDue.toFixed(2)} will be charged`)
    if (parts.length === 0) parts.push('No charge due')
    toast.success('Lifetime deal purchased. ' + parts.join(', '))
    refresh()
  }

  // Hooks MUST be called in the same order on every render. Compute
  // the derived view model + card states here, before any early
  // returns below. When vm is null these collapse to safe defaults.
  const state = vm?.state
  const plan = vm?.plan
  const wallet = vm?.wallet
  const isOnLifetime = state?.status === 'lifetime_active' && state?.lifetimeTier
  const catalog = state?.usesRestructuredTier ? RESTRUCTURED_LIFETIME : TRADITIONAL_LIFETIME
  const currentLifetime = isOnLifetime ? plan : null

  const cardStates = useMemo(() => {
    if (!state) return {}
    const map = {}
    for (const t of catalog) {
      if (currentLifetime?.id === t.id) {
        map[t.id] = { state: 'current', reason: null }
        continue
      }
      if (currentLifetime?.topTier) {
        map[t.id] = { state: 'disabled', reason: 'You are already on the top lifetime tier. No further upgrade available.' }
        continue
      }
      if (currentLifetime && t.priceUsd <= currentLifetime.priceUsd) {
        map[t.id] = { state: 'disabled', reason: 'Cannot downgrade a lifetime deal. You can only upgrade to a higher tier.' }
        continue
      }
      map[t.id] = { state: 'available', reason: null }
    }
    return map
  }, [catalog, currentLifetime, state])

  // Early returns (no hooks below this line).
  if (!activeOrgId) return null
  if (!isOwner) return <RestrictedAccess />

  if (!vm) {
    return (
      <PageContainer size="lg">
        <PageHeader title="Lifetime Deals" description="One-time payment, servers forever." />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </PageContainer>
    )
  }

  // Legacy grandfathered: lifetime section hidden.
  if (state.legacyInfo) {
    return (
      <PageContainer size="lg">
        <PageHeader
          title="Lifetime Deals"
          description="One-time payment, servers forever."
        >
          <PersonaSwitcher onChange={refresh} />
        </PageHeader>
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
          Lifetime deals are not available for legacy / grandfathered plans. Your current plan is <strong>{state.legacyInfo.name}</strong>.
        </p>
      </PageContainer>
    )
  }

  return (
    <PageContainer size="lg">
      <PageHeader
        title="Lifetime Deals"
        description="One-time payment, servers forever. No renewals, no surprises."
      >
        <PersonaSwitcher onChange={refresh} />
      </PageHeader>

      <div className="mt-6 space-y-5">
        {/* Current lifetime banner / "no further upgrade" / "your deal" card */}
        {isOnLifetime && currentLifetime && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-gradient-to-br from-amber-50 via-white to-white dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20 shrink-0">
                <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  You own {currentLifetime.name}
                </h3>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                  {currentLifetime.topTier
                    ? 'This is the top lifetime tier — no further upgrades available. Thank you for being a lifetime customer.'
                    : `You can upgrade to a higher tier at any time. Existing lifetime credit of $${currentLifetime.priceUsd.toLocaleString()} applies to the upgrade price.`}
                </p>
                {state.lifetimePurchasedAt && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Purchased {new Date(state.lifetimePurchasedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Extra slots for slot-limited lifetime users */}
        {isOnLifetime && currentLifetime && !currentLifetime.topTier && (
          <ExtraSlotsCard
            state={state}
            plan={currentLifetime}
            walletBalance={wallet.balance}
            onChange={refresh}
          />
        )}

        {/* Lifetime grid — same pattern as /billing/plans: 4-up at xl,
            2x2 at md, 1-up on mobile. Closes the 3+1 layout problem we
            just fixed on the Plans page. */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          {catalog.map((t) => {
            const info = cardStates[t.id] || { state: 'available', reason: null }
            return (
              <LifetimeCard
                key={t.id}
                tier={t}
                state={info.state}
                disabledReason={info.reason}
                isTopTier={t.topTier}
                onPurchase={handleBuy}
              />
            )
          })}
        </div>

        {/* Hint for buyers not on a lifetime yet */}
        {!isOnLifetime && (
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Lifetime deals can be paid with wallet credit. Recurring plans can be canceled and switched to lifetime anytime.
          </p>
        )}
      </div>
    </PageContainer>
  )
}