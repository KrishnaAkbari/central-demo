'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Wallet,
  Server as ServerIcon,
  Calendar,
  Crown,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Receipt,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { balanceDelta, sumThisMonthNet, sumLifetimeSpent } from '@/lib/billing-math'
import { useIsOwner, useBillingVersion } from '@/stores/organizationStore'
import { useOrganizationStore } from '@/stores/organizationStore'
import { RestrictedAccess } from '@/components/billing/RestrictedAccess'
import { PersonaSwitcher } from '@/components/billing/PersonaSwitcher'
import { TransactionTypeBadge } from '@/components/billing/TransactionTypeBadge'
import { MultiOrgBillingSummary, useMultiOrgBillingSummary } from '@/components/billing/MultiOrgBillingSummary'
import { getOverviewViewModel, getMultiOrgBillingSummary } from '@/services/billingApi'

// Billing Overview — main landing for /billing. Layout (top to bottom):
//  1. Next-charge row (single line, single CTA) — only for paid plans.
//     Trial / lifetime / free / canceled get their own hero block.
//  2. Lifetime banner (only when applicable)
//  3. Server usage bar (only when plan has a serverLimit)
//  4. Trial card (only when trial_active / trial_expired)
//  5. Recent activity (last 3 transactions)
//  6. Recommended action (if any)
//
// No more 5-card grid — this is one screen with everything you need.
function fmtUsd(n) {
  return `$${(Number(n) || 0).toFixed(2)}`
}
function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function BillingOverviewPage() {
  const isOwner = useIsOwner()
  const billingVersion = useBillingVersion()
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  const router = useRouter()
  const [vm, setVm] = useState(null)
  const [multiOrgSummary, setMultiOrgSummary] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const { switchOrg } = useMultiOrgBillingSummary()

  useEffect(() => {
    if (!activeOrgId) return
    setVm(getOverviewViewModel())
    setMultiOrgSummary(getMultiOrgBillingSummary())
  }, [activeOrgId, refreshKey, billingVersion])

  if (!activeOrgId) return null
  if (!isOwner) return <RestrictedAccess />

  if (!vm) {
    return (
      <PageContainer size="lg">
        <PageHeader title="Billing Overview" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </PageContainer>
    )
  }

  const {
    state, wallet, transactions, serverCount, currentPlan,
    currentAccessLabel, statusLabel, statusTone, recommendedAction,
    trialDaysRemaining, nextChargeAt, nextChargeAmount,
    trialEndAt, isLifetime, lifetimeTier,
  } = vm

  // Derive sub-views for conditional sections
  const serverLimit = currentPlan?.serverLimit ?? null
  const extraSlotPrice = currentPlan?.extraSlotPriceUsd ?? null
  const isPaidPlan = !!(
    state.status === 'active' &&
    state.planTier && state.planTier !== 'free' &&
    currentPlan && currentPlan.priceUsd > 0
  )
  const isCanceled = state.status === 'canceled' && state.currentPeriodEnd
  const isTrialActive = state.trialState === 'trial_active'
  const isTrialExpired = state.trialState === 'trial_expired'

  // Top "hero" line selection — exactly one renders at a time
  const heroKind = (() => {
    if (isLifetime) return 'lifetime'
    if (isTrialActive) return 'trial-active'
    if (isTrialExpired) return 'trial-expired'
    if (isCanceled) return 'canceled'
    if (isPaidPlan) return 'next-charge'
    return 'free'
  })()

  // Metric tiles row — computed from the same transactions the wallet
  // page uses (via the shared balanceDelta from lib/billing-math), so
  // Overview and Wallet agree on "what does this number mean". Built
  // before any early returns so it can sit alongside the JSX without
  // the rules-of-hooks lint firing.
  const thisMonthNet = sumThisMonthNet(transactions)
  const lifetimeSpent = sumLifetimeSpent(transactions)
  const serverPct = serverLimit ? Math.min(100, Math.round((serverCount / serverLimit) * 100)) : null
  const debitCount = transactions.filter((t) => balanceDelta(t) < 0).length

  return (
    <PageContainer size="lg">
      <PageHeader
        title="Billing Overview"
        description="Current access, next charge, and recent activity for this organization."
      >
        <PersonaSwitcher onChange={() => setRefreshKey((k) => k + 1)} />
      </PageHeader>

      {/* Multi-org combined summary (round 5) — only renders for users
          who belong to 2+ organizations. Single-org users get the hero
          block below as their only "where am I, what do I owe" surface. */}
      <MultiOrgBillingSummary summary={multiOrgSummary} onSwitchOrg={switchOrg} />

      {/* Hero block — one of next-charge / lifetime / trial / canceled / free */}
      {heroKind === 'next-charge' && (
        <Card className="p-5 border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                <Calendar className="h-3.5 w-3.5" />
                Next charge
              </div>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                {fmtUsd(nextChargeAmount)} <span className="text-base font-normal text-slate-500 dark:text-slate-400">on {fmtDate(nextChargeAt)}</span>
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {wallet.balance >= nextChargeAmount
                  ? <>Wallet covers it — <span className="font-medium text-emerald-700 dark:text-emerald-300">{fmtUsd(wallet.balance)} available</span></>
                  : <>{fmtUsd(wallet.balance)} in wallet · shortfall {fmtUsd(nextChargeAmount - wallet.balance)}</>
                }
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <Button asChild variant="outline">
                <Link href="/billing/wallet">Add wallet credit</Link>
              </Button>
              <Button asChild type="button">
                <Link href="/billing/plans">Change plan</Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {heroKind === 'lifetime' && (
        <Card className="p-5 border-amber-300 dark:border-amber-500/40 bg-gradient-to-br from-amber-50 via-white to-white dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20 shrink-0">
              <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Lifetime access
                </p>
                <Badge variant="warning">Active forever</Badge>
              </div>
              <p className="mt-1 text-[24px] sm:text-[24px] font-bold text-slate-900 dark:text-white">
                {currentAccessLabel.replace(/^Lifetime\s+/i, '')} Lifetime
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                One-time payment, no renewals. {serverLimit ? `Up to ${serverLimit} servers included.` : 'Unlimited servers included.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => router.push('/billing/lifetime')}>
                  Manage lifetime deal
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {heroKind === 'trial-active' && (
        <Card className="p-5 border-sky-200 dark:border-sky-500/30 bg-sky-50/50 dark:bg-sky-950/20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-sky-700 dark:text-sky-300">
                <Calendar className="h-3.5 w-3.5" />
                Trial
              </div>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                {trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'} remaining
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Trial ends {fmtDate(trialEndAt)} · choose a plan before then to keep paid access.
              </p>
            </div>
            <Button onClick={() => router.push('/billing/plans')}>
              Choose a plan
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {heroKind === 'trial-expired' && (
        <Card className="p-5 border-amber-300 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                Trial ended
              </div>
              <p className="mt-1 text-[24px] sm:text-[24px] font-bold text-slate-900 dark:text-white">
                Now on Free plan
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Free plan supports 1 server. Choose a paid plan for more capacity.
              </p>
            </div>
            <Button onClick={() => router.push('/billing/plans')}>
              Choose a plan
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {heroKind === 'canceled' && (
        <Card className="p-5 border-amber-300 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                Subscription canceled
              </div>
              <p className="mt-1 text-[24px] sm:text-[24px] font-bold text-slate-900 dark:text-white">
                Access until {fmtDate(state.currentPeriodEnd)}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Resume anytime to keep paid access.
              </p>
            </div>
            <Button onClick={() => router.push('/billing/plans')}>
              Resume plan
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {heroKind === 'free' && (
        <Card className="p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Current access
              </p>
              <h3 className="mt-1 text-[24px] sm:text-[24px] font-bold text-slate-900 dark:text-white">
                {currentAccessLabel}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Free plan · 1 server · community support
              </p>
            </div>
            <Button onClick={() => router.push('/billing/plans')}>
              See plans
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Quick metrics — 4 tiles that summarize wallet, monthly net,
          server usage, and lifetime spend at a glance. Replaces the
          old "Wallet: $X / Servers: Y / Status: Z" footer row with a
          proper stat block above the detail sections. Server tile
          complements the progress-bar Server usage card below (number
          here, visual bar there). */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Wallet className="h-3.5 w-3.5" />
            Wallet balance
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {fmtUsd(wallet.balance)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            available now
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {thisMonthNet > 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            ) : thisMonthNet < 0 ? (
              <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
            ) : (
              <Calendar className="h-3.5 w-3.5" />
            )}
            This month
          </div>
          <div
            className={cn(
              'mt-2 text-2xl font-bold tabular-nums',
              thisMonthNet > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : thisMonthNet < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
            )}
          >
            {thisMonthNet === 0
              ? '$0.00'
              : `${thisMonthNet > 0 ? '+' : ''}${fmtUsd(thisMonthNet)}`}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            net change
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <ServerIcon className="h-3.5 w-3.5" />
            Servers
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {serverLimit ? `${serverCount} of ${serverLimit}` : `${serverCount}`}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {serverPct !== null
              ? `${serverPct}% used`
              : 'unlimited'}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Receipt className="h-3.5 w-3.5" />
            Lifetime spent
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {fmtUsd(lifetimeSpent)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {debitCount === 0
              ? 'no debits yet'
              : `across ${debitCount} debit${debitCount === 1 ? '' : 's'}`}
          </div>
        </Card>
      </div>

      {/* Server usage (only when plan has known limit) */}
      {serverLimit && isPaidPlan && (
        <Card className="p-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ServerIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Server usage
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {serverCount} of {serverLimit}
              </p>
            </div>
            <Progress
              value={Math.min(100, (serverCount / serverLimit) * 100)}
              indicatorClassName={cn(
                serverCount >= serverLimit
                  ? 'bg-amber-500'
                  : serverCount / serverLimit > 0.8
                  ? 'bg-amber-400'
                  : 'bg-indigo-500'
              )}
            />
            {extraSlotPrice && serverCount >= serverLimit && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                You&apos;ve hit the server limit. Extra slots: {fmtUsd(extraSlotPrice)}/mo each.
              </p>
            )}
            {extraSlotPrice && serverCount < serverLimit && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Extra slots: {fmtUsd(extraSlotPrice)}/mo each.
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Lifetime status (only when free / legacy / etc and lifetime deal exists) */}
      {!isLifetime && state.status !== 'lifetime_active' && lifetimeTier && (
        <Card className="p-5 border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Lifetime deal: {currentAccessLabel.replace(/^Lifetime\s+/i, '')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage your lifetime access.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/billing/lifetime">Manage deal</Link>
            </Button>
          </div>
        </Card>
      )}

      {/* Recommended action (if any) */}
      {recommendedAction && (
        <Card className={cn(
          'p-5',
          recommendedAction.tone === 'warning'
            ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10'
            : 'border-sky-200 dark:border-sky-500/30 bg-sky-50/30 dark:bg-sky-950/10'
        )}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={cn(
              'h-4 w-4 mt-0.5 shrink-0',
              recommendedAction.tone === 'warning'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-sky-600 dark:text-sky-400'
            )} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {recommendedAction.title}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {recommendedAction.body}
              </p>
            </div>
            {recommendedAction.cta?.href && (
              <Button asChild variant="outline" size="sm">
                <Link href={recommendedAction.cta.href}>
                  {recommendedAction.cta.label}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Recent activity */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Recent activity
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/billing/transactions">
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
        {transactions.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No transactions yet.
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Top up your wallet or pick a plan to start activity.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/billing/wallet">Add wallet credit</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/billing/plans">See plans</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions.slice(0, 3).map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 dark:text-white truncate">
                    {tx.description || tx.type}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {fmtDate(tx.createdAt)} · {tx.plan || tx.type}
                  </p>
                </div>
                <TransactionTypeBadge type={tx.type} />
                <span className={cn(
                  'tabular-nums font-semibold shrink-0',
                  tx.amount >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-900 dark:text-white'
                )}>
                  {tx.amount >= 0 ? '+' : ''}{fmtUsd(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

    </PageContainer>
  )
}
