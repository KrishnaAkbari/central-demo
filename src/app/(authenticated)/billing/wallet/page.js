'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Wallet as WalletIcon,
  Plus,
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Activity,
} from 'lucide-react'
import Link from 'next/link'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PersonaSwitcher } from '@/components/billing/PersonaSwitcher'
import { balanceDelta as _balanceDelta } from '@/lib/billing-math'
import { RestrictedAccess } from '@/components/billing/RestrictedAccess'
import { AddCreditDialog } from '@/components/billing/AddCreditDialog'
import { TransactionTypeBadge } from '@/components/billing/TransactionTypeBadge'
import {
  getActiveOrgBilling,
  getWallet,
  setWalletBalance,
  appendTransaction,
  getAutoRecharge,
  countActiveServers,
} from '@/services/billingApi'
import { getActiveOrgId } from '@/services/billingApi'
import { useIsOwner, useBillingVersion } from '@/stores/organizationStore'
import {
  formatTxDate,
  formatUsd,
  TONE_CLASSES,
} from '@/components/billing/transactionLabels'

// Compute the wallet balance delta for one transaction. Used by the stats
// row, the sparkline, and the burn-rate calculation so all surfaces agree
// on what counts as a real balance change. See the table in the docs
// balanceDelta is now imported from @/lib/billing-math (single source
// of truth shared with /billing/overview). The full per-tx-type
// reasoning lives in that file's header comment. Local alias keeps
// call sites unchanged.
const balanceDelta = _balanceDelta

// Reconstruct a 30-day daily balance series from the localStorage
// transaction log. We walk backward from the current balance to derive the
// balance 30 days ago, then walk forward day-by-day applying any
// transactions that happened on each day. Days with no transactions
// inherit the previous day's balance (flat segments in the sparkline).
// Uses `balanceDelta` instead of raw `amount` so the curve shape is
// correct (charges drop, top-ups rise) instead of always ascending.
function build30DaySeries(currentBalance, allTxs, now = new Date()) {
  const DAY_MS = 24 * 60 * 60 * 1000
  const startOfDay = (d) => {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
  }
  const today = startOfDay(now)
  const days = []
  for (let i = 29; i >= 0; i -= 1) {
    days.push(new Date(today.getTime() - i * DAY_MS))
  }
  const inWindow = allTxs
    .map((t) => ({ delta: balanceDelta(t), day: t.createdAt ? startOfDay(new Date(t.createdAt)) : null }))
    .filter((t) => t.day && t.day.getTime() >= days[0].getTime() && t.day.getTime() <= today.getTime())
  const netInWindow = inWindow.reduce((s, t) => s + t.delta, 0)
  const openingBalance = Math.max(0, currentBalance - netInWindow)
  const dailyDeltas = days.map(() => 0)
  for (const t of inWindow) {
    const idx = Math.round((t.day.getTime() - days[0].getTime()) / DAY_MS)
    if (idx >= 0 && idx < dailyDeltas.length) dailyDeltas[idx] += t.delta
  }
  const out = []
  let bal = openingBalance
  for (let i = 0; i < days.length; i += 1) {
    bal += dailyDeltas[i]
    out.push({ date: days[i], balance: Math.max(0, Math.round(bal * 100) / 100) })
  }
  return out
}

function Sparkline({ series, hasAnyActivity }) {
  const W = 240
  const H = 72
  const PAD_X = 10
  const PAD_Y = 6
  if (!hasAnyActivity || series.length === 0) {
    return (
      <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          No balance history yet
        </p>
      </div>
    )
  }
  const values = series.map((p) => p.balance)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = (W - PAD_X * 2) / Math.max(1, series.length - 1)
  const points = series.map((p, i) => {
    const x = PAD_X + i * stepX
    const y = PAD_Y + (H - PAD_Y * 2) * (1 - (p.balance - min) / range)
    return [x, y]
  })
  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ')
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(2)},${H - PAD_Y} L${points[0][0].toFixed(2)},${H - PAD_Y} Z`
  const lastPoint = points[points.length - 1]
  const trendUp = values[values.length - 1] >= values[0]
  // Two gradients per trend direction: one tuned for light mode (deeper hue,
  // lower alpha so it doesn't overwhelm the white card), one tuned for dark
  // mode (brighter hue, higher alpha so it reads against slate-900).
  const gradLight = trendUp ? 'url(#spark-up-light)' : 'url(#spark-down-light)'
  const gradDark = trendUp ? 'url(#spark-up-dark)' : 'url(#spark-down-dark)'
  const lineClass = trendUp
    ? 'stroke-emerald-600 dark:stroke-emerald-300'
    : 'stroke-rose-600 dark:stroke-rose-300'
  const dotClass = trendUp
    ? 'fill-emerald-600 dark:fill-emerald-300'
    : 'fill-rose-600 dark:fill-rose-300'
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      className="block overflow-visible"
      role="img"
      aria-label="Wallet balance over the last 30 days"
    >
      <defs>
        <linearGradient id="spark-up-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(16,185,129,0.30)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0)" />
        </linearGradient>
        <linearGradient id="spark-down-light" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(244,63,94,0.30)" />
          <stop offset="100%" stopColor="rgba(244,63,94,0)" />
        </linearGradient>
        <linearGradient id="spark-up-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(52,211,153,0.42)" />
          <stop offset="100%" stopColor="rgba(52,211,153,0)" />
        </linearGradient>
        <linearGradient id="spark-down-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(251,113,133,0.42)" />
          <stop offset="100%" stopColor="rgba(251,113,133,0)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={gradLight} className="dark:hidden" />
      <path d={areaPath} fill={gradDark} className="hidden dark:inline" />
      <path
        d={linePath}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={lineClass}
      />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="3.5" className={dotClass} />
    </svg>
  )
}

function ThirtyDayActivity({ balance, txs }) {
  const series = useMemo(() => build30DaySeries(balance, txs), [balance, txs])
  const hasAnyActivity = txs.length > 0
  // Spend = any tx that actually debited the wallet, not just any tx with
  // a positive gross amount (invoices use gross, but burn rate is about
  // wallet outflow). Uses the module-level `balanceDelta` so this stays
  // in sync with the stats row and the sparkline.
  const spendTxs = txs.filter((t) => balanceDelta(t) < 0)
  const totalSpend = spendTxs.reduce((s, t) => s + Math.abs(balanceDelta(t)), 0)
  const perMonth = totalSpend
  const dailyBurn = totalSpend / 30
  const runwayDays = dailyBurn > 0 ? balance / dailyBurn : null
  const runwayWarn = runwayDays !== null && runwayDays < 1
  const trendUp = series.length >= 2 ? series[series.length - 1].balance >= series[0].balance : true
  return (
    <Card className="p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
        <Activity className="h-4 w-4 text-emerald-500" />
        Last 30 days
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Balance trend, monthly burn rate, and how long your balance will last.
      </p>

      <div className="mt-5 flex-1 min-h-[120px]">
        <Sparkline series={series} hasAnyActivity={hasAnyActivity} />
      </div>

      {hasAnyActivity && series.length >= 2 && (() => {
        const minBal = Math.min(...series.map((p) => p.balance))
        const maxBal = Math.max(...series.map((p) => p.balance))
        const minFmt = formatUsd(minBal)
        const maxFmt = formatUsd(maxBal)
        const sameFmt = minFmt === maxFmt
        return (
          <div className="mt-2 flex items-center justify-between text-2xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span>30d low {minFmt}</span>
            <span>{sameFmt ? 'held steady' : `30d high ${maxFmt}`}</span>
          </div>
        )
      })()}

      <dl className="mt-5 space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
            {trendUp ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
            )}
            Monthly burn rate
          </dt>
          <dd className="font-medium text-slate-900 dark:text-white tabular-nums">
            {perMonth > 0 ? formatUsd(perMonth) : '—'}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-500 dark:text-slate-400">Runway</dt>
          <dd
            className={[
              'font-medium tabular-nums',
              runwayWarn
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-900 dark:text-white',
            ].join(' ')}
          >
            {runwayDays === null
              ? 'No spending yet'
              : runwayWarn
                ? 'Less than a day'
                : `~${Math.round(runwayDays)} days`}
          </dd>
        </div>
      </dl>
    </Card>
  )
}

export default function BillingWalletPage() {
  const isOwner = useIsOwner()
  const billingVersion = useBillingVersion()
  const [refreshKey, setRefreshKey] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [orgId, setOrgId] = useState(null)
  const [vm, setVm] = useState(null)

  // Read everything in one effect — keeps the wallet, auto-recharge,
  // recent tx, and server count in sync after any state change.
  useEffect(() => {
    if (!isOwner) return
    const id = getActiveOrgId()
    setOrgId(id)
    if (!id) {
      setVm(null)
      return
    }
    const billing = getActiveOrgBilling()
    const wallet = getWallet(id)
    const ar = getAutoRecharge(id)
    const txs =
      (typeof window !== 'undefined' &&
        JSON.parse(localStorage.getItem('cp_transactions') || '{}')[id]) ||
      []
    const serverCount = countActiveServers(id)
    setVm({ billing, wallet, ar, txs, serverCount })
  }, [refreshKey, isOwner, billingVersion])

  // Hoist all useMemo before any early returns — Rules of Hooks.
  const recent = useMemo(() => {
    if (!vm?.txs) return []
    // All wallet-related activity: anything the user might want to see
    // next to their balance. We cap at 8 to keep the card scannable;
    // full history is one click away via the Transactions tab.
    // Renewals/lifetime purchases count as wallet activity only when the
    // wallet actually covered part of the cost (walletApplied > 0);
    // otherwise the card paid in full and the wallet wasn't touched.
    return vm.txs
      .filter((t) => {
        if (['credit_added', 'wallet_debit', 'extra_slot', 'recurring', 'refund'].includes(t.type)) return true
        if (['plan_renewal', 'lifetime_purchase'].includes(t.type) && Number(t.walletApplied) > 0) return true
        return false
      })
      .slice(0, 8)
  }, [vm?.txs])

  // Quick stats for the bottom of the balance card. Last top-up is the
  // most recent credit_added; this-month is the net of all transactions
  // since the 1st of the current month; lifetime spent sums all debits.
  // These three numbers give the user at-a-glance context for the
  // balance without duplicating the 30-day card (trend/runway) or the
  // recent activity list below (itemised transactions). Uses the
  // module-level `balanceDelta` so the math matches the sparkline and
  // the burn-rate calculation.
  const stats = useMemo(() => {
    const txs = vm?.txs || []
    const lastTopUp = txs
      .filter((t) => t.type === 'credit_added')
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthNet = txs
      .filter((t) => t.createdAt && new Date(t.createdAt) >= monthStart)
      .reduce((s, t) => s + balanceDelta(t), 0)
    const debits = txs.filter((t) => balanceDelta(t) < 0)
    const lifetimeSpent = debits.reduce((s, t) => s + Math.abs(balanceDelta(t)), 0)
    return { lastTopUp, thisMonthNet, lifetimeSpent, debitCount: debits.length }
  }, [vm?.txs])

  // Non-owner early return AFTER all hooks.
  if (!isOwner) return <RestrictedAccess />

  if (!vm) {
    return (
      <PageContainer>
        <PageHeader title="Wallet" description="Loading…" />
      </PageContainer>
    )
  }

  const { wallet, ar, serverCount } = vm
  const balance = wallet.balance || 0
  const recurringMonthlyCost = 0 // could be derived from current plan + servers; left as a
  // hook point for the recurring-cost estimator. For the prototype, this
  // number is shown but stays constant (0) unless the user has a recurring
  // plan — the visibility is what matters for UI testing.

  const handleAdded = (amount) => {
    if (!orgId) return
    const newBalance = balance + amount
    setWalletBalance(orgId, newBalance)
    appendTransaction(orgId, {
      type: 'credit_added',
      amount,
      description: `Wallet credit added ($${amount.toFixed(2)})`,
      amountDue: 0,
    })
    setRefreshKey((k) => k + 1)
  }

  const lowBalance = balance < 10
  const belowThreshold = ar.enabled && balance < (ar.thresholdUsd || 0)
  const autoRechargeActiveClass = ar.enabled
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:border-slate-600'

  return (
    <PageContainer>
      <PageHeader
        title="Wallet"
        description="Balance, add credit, auto recharge status, recent wallet transactions."
      >
        <PersonaSwitcher />
      </PageHeader>

      <div className="space-y-6">
        {/* Top row: balance card + auto-recharge status */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Balance card */}
          <Card className="lg:col-span-2 p-6 overflow-hidden relative h-full flex flex-col">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-100/60 dark:bg-emerald-500/10 blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <WalletIcon className="h-4 w-4" />
                <span>Available balance</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[24px] sm:text-[24px] font-bold text-slate-900 dark:text-white tracking-tight">
                  {formatUsd(balance)}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {wallet.currency || 'USD'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant={ar.enabled ? 'success' : 'secondary'} className="rounded-full px-2.5 py-0.5 text-xs font-medium gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Auto-recharge {ar.enabled ? 'on' : 'off'}
                  {ar.enabled && (
                    <>
                      {' '}· triggers at {formatUsd(ar.thresholdUsd || 0)}
                      {' '}· adds {formatUsd(ar.rechargeAmountUsd || 0)}
                    </>
                  )}
                </Badge>
                {serverCount > 0 && (
                  <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs">
                    {serverCount} active server{serverCount === 1 ? '' : 's'}
                  </Badge>
                )}
              </div>
            </div>
            <div className="relative mt-5 flex flex-wrap items-center justify-end gap-2">
              <Button type="button" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Add credit
              </Button>
              <Button asChild variant="outline">
                <Link href="/billing/auto-recharge">
                  {ar.enabled ? 'Manage auto-recharge' : 'Set up auto-recharge'}
                </Link>
              </Button>
            </div>
            {(lowBalance || belowThreshold) && (
              <div className="mt-5 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-500/15 dark:border-amber-500/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  {belowThreshold
                    ? `Balance is below your auto-recharge threshold (${formatUsd(ar.thresholdUsd || 0)}). The next scheduled top-up will bring it back to ${formatUsd(ar.rechargeAmountUsd || 0)}.`
                    : 'Your wallet is running low. Top up now to keep using wallet credits on renewals and extra slot purchases.'}
                </div>
              </div>
            )}

            {/* Quick stats row — fills the bottom of the balance card so
                it matches the 30-day card's height without showing empty
                space. Three small tiles: last top-up, this month net,
                lifetime spent. Pushed to the bottom with mt-auto so the
                gap between the buttons and the stats is the natural
                flex fill. */}
            <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-3 gap-4 sm:gap-6">
                <div>
                  <div className="text-xxs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Last top-up
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                    {stats.lastTopUp ? `+${formatUsd(stats.lastTopUp.amount)}` : '—'}
                  </div>
                  <div className="text-2xs text-slate-500 dark:text-slate-400">
                    {stats.lastTopUp ? formatTxDate(stats.lastTopUp.createdAt) : 'No top-ups yet'}
                  </div>
                </div>
                <div>
                  <div className="text-xxs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    This month
                  </div>
                  <div
                    className={[
                      'mt-1 text-sm font-semibold tabular-nums',
                      stats.thisMonthNet > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : stats.thisMonthNet < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-900 dark:text-white',
                    ].join(' ')}
                  >
                    {stats.thisMonthNet === 0
                      ? '—'
                      : `${stats.thisMonthNet > 0 ? '+' : ''}${formatUsd(stats.thisMonthNet)}`}
                  </div>
                  <div className="text-2xs text-slate-500 dark:text-slate-400">
                    net change
                  </div>
                </div>
                <div>
                  <div className="text-xxs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Lifetime spent
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                    {stats.lifetimeSpent > 0 ? formatUsd(stats.lifetimeSpent) : '$0.00'}
                  </div>
                  <div className="text-2xs text-slate-500 dark:text-slate-400">
                    {stats.debitCount === 0
                      ? 'no debits yet'
                      : `across ${stats.debitCount} debit${stats.debitCount === 1 ? '' : 's'}`}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* 30-day activity side card (sparkline + burn rate + runway) */}
          <ThirtyDayActivity balance={balance} txs={vm.txs} />
        </div>

        {/* Recent wallet activity */}
        <Card className="p-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Recent wallet activity
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Last {recent.length} wallet-related transactions.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/billing/transactions">
                View full history
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          {recent.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-slate-400" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
                No wallet activity yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Add credit or pay for a recurring plan / lifetime deal to see transactions here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recent.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TransactionTypeBadge type={t.type} />
                      <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
                        {t.description || (t.type === 'extra_slot' ? 'Extra server slot' : '')}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {formatTxDate(t.createdAt)}
                      {t.status && t.status !== 'completed' && (
                        <>
                          {' · '}
                          <span className={['font-medium', t.status === 'failed' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'].join(' ')}>
                            {t.status}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className={[
                      'shrink-0 text-sm font-semibold tabular-nums',
                      // Wallet-side view: show the wallet portion only. For a
                      // renewal that was paid entirely from card, this stays
                      // zero and we already filter it out of the list (see
                      // `recent` useMemo). For a renewal that drained the
                      // wallet, show that as a debit so the user sees what
                      // really affected their balance.
                      (t.type === 'plan_renewal' || t.type === 'lifetime_purchase')
                        ? (t.walletApplied > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-700 dark:text-slate-200')
                        : t.amount > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-700 dark:text-slate-200',
                    ].join(' ')}
                  >
                    {(t.type === 'plan_renewal' || t.type === 'lifetime_purchase')
                      ? (t.walletApplied > 0
                          ? `-${formatUsd(t.walletApplied)}`
                          : formatUsd(0))
                      : `${t.amount > 0 ? '+' : ''}${formatUsd(t.amount)}`}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <AddCreditDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        currentBalance={balance}
        onAdded={handleAdded}
      />
    </PageContainer>
  )
}
