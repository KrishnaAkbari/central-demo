'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Receipt,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  CircleDollarSign,
  Calendar,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PersonaSwitcher } from '@/components/billing/PersonaSwitcher'
import { RestrictedAccess } from '@/components/billing/RestrictedAccess'
import { TransactionTypeBadge } from '@/components/billing/TransactionTypeBadge'
import { TransactionStatusBadge } from '@/components/billing/TransactionStatusBadge'
import { InvoicePdfButton } from '@/components/billing/InvoicePdfButton'
import { isChargeableInvoice } from '@/services/invoicePdf'
import { buildBulkInvoiceHtml } from '@/services/invoiceBulkPdf'
import {
  getActiveOrgBilling,
  getTransactions,
  getWallet,
  getActiveOrgId,
} from '@/services/billingApi'
import { useIsOwner, useBillingVersion, useActiveOrganization } from '@/stores/organizationStore'
import {
  formatTxDateShort,
  formatTxTime,
  formatUsd,
  TX_FILTER_GROUPS,
} from '@/components/billing/transactionLabels'

// Sort orders for the date column.
const SORT_NEWEST = 'newest'
const SORT_OLDEST = 'oldest'

export default function BillingTransactionsPage() {
  const isOwner = useIsOwner()
  const billingVersion = useBillingVersion()
  const activeOrg = useActiveOrganization()
  const orgName = activeOrg?.name || 'ServerAvatar Customer'
  const orgId = activeOrg?.id || null
  const [refreshKey, setRefreshKey] = useState(0)
  const [bulkExporting, setBulkExporting] = useState(false)
  const [vm, setVm] = useState(null)
  const [filterId, setFilterId] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(SORT_NEWEST)
  // Pagination — show 25 per page, allow "Load more".
  const PAGE_SIZE = 25
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    if (!isOwner) return
    const id = getActiveOrgId()
    if (!id) {
      setVm(null)
      return
    }
    const billing = getActiveOrgBilling()
    const wallet = getWallet(id)
    const txs = getTransactions(id)
    setVm({ billing, wallet, txs })
  }, [refreshKey, isOwner, billingVersion])

  // Hoist all useMemo before any early returns — Rules of Hooks.
  const filtered = useMemo(() => {
    if (!vm?.txs) return []
    const group = TX_FILTER_GROUPS.find((g) => g.id === filterId)
    let list = vm.txs
    if (group && group.types) list = list.filter((t) => group.types.includes(t.type))
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          (t.description || '').toLowerCase().includes(q) ||
          (t.type || '').toLowerCase().includes(q),
      )
    }
    list = [...list].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime() || 0
      const tb = new Date(b.createdAt).getTime() || 0
      return sort === SORT_NEWEST ? tb - ta : ta - tb
    })
    return list
  }, [vm?.txs, filterId, query, sort])

  // Aggregate stats: total for the whole filtered set, and count by type.
  const stats = useMemo(() => {
    if (!vm?.txs) return { total: 0, count: 0, paid: 0, free: 0 }
    const total = filtered.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    const paid = filtered.filter((t) => (t.amount || 0) > 0).length
    return {
      total,
      count: filtered.length,
      paid,
      free: filtered.length - paid,
    }
  }, [filtered, vm?.txs])

  // Counts per filter group (drives chip badges — small extra work for
  // a much clearer "see what's behind each tab" UX).
  const filterCounts = useMemo(() => {
    const out = {}
    for (const g of TX_FILTER_GROUPS) {
      const list =
        g.types === null ? vm?.txs || [] : (vm?.txs || []).filter((t) => g.types.includes(t.type))
      out[g.id] = list.length
    }
    return out
  }, [vm?.txs])

  // Eligible transactions for invoice PDF generation (positive charge
  // rows only). Drives the bulk export button's enabled state and the
  // per-row button's disabled state. Hoisted above the early return for
  // Rules of Hooks.
  const eligibleCount = useMemo(
    () => filtered.filter(isChargeableInvoice).length,
    [filtered],
  )

  // Bulk export: build one printable HTML document containing a cover
  // sheet + every chargeable transaction, then open the print dialog so
  // the user picks "Save as PDF" as the destination. Same iframe trick
  // as the per-row InvoicePdfButton. Hoisted above the early return for
  // Rules of Hooks (it's a plain const + arrow function, not a hook,
  // but we keep the bulk-export wiring near the eligibleCount memo so
  // it's easy to read).
  const handleBulkExport = () => {
    if (bulkExporting || eligibleCount === 0) return
    const eligible = filtered.filter(isChargeableInvoice)
    const html = buildBulkInvoiceHtml(eligible, { orgId, orgName })
    if (!html) return
    setBulkExporting(true)
    try {
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.setAttribute('aria-hidden', 'true')
      iframe.setAttribute('data-testid', 'bulk-export-pdf-iframe')
      document.body.appendChild(iframe)
      const triggerPrint = () => {
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (!doc) {
          console.warn('[bulk-invoice-pdf] no document on iframe, bailing')
          setBulkExporting(false)
          try { iframe.remove() } catch {}
          return
        }
        doc.open()
        doc.write(html)
        doc.close()
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
          } catch (err) {
            console.warn('[bulk-invoice-pdf] print failed:', err)
          } finally {
            setTimeout(() => {
              try { iframe.remove() } catch {}
              setBulkExporting(false)
            }, 1500)
          }
        }, 100)
      }
      if (iframe.contentDocument?.readyState === 'complete') {
        triggerPrint()
      } else {
        iframe.addEventListener('load', triggerPrint, { once: true })
      }
    } catch (err) {
      console.error('[bulk-invoice-pdf] generation failed:', err)
      setBulkExporting(false)
    }
  }

  // Non-owner early return AFTER all hooks.
  if (!isOwner) return <RestrictedAccess />

  if (!vm) {
    return (
      <PageContainer>
        <PageHeader title="Invoices" description="Loading…" />
      </PageContainer>
    )
  }

  const { wallet } = vm

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  return (
    <PageContainer>
      <PageHeader
        title="Invoices"
        description="Every charge, refund, wallet credit and plan change — one searchable timeline."
      >
        <PersonaSwitcher />
      </PageHeader>

      <div className="space-y-6">
        {/* Top stats row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Receipt className="h-3.5 w-3.5" />
              Total in current view
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {formatUsd(stats.total)}
            </div>
            <div className="mt-1 text-2xs text-slate-500 dark:text-slate-400">
              {stats.count} transactions
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
              Charges
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {stats.paid}
            </div>
            <div className="mt-1 text-2xs text-slate-500 dark:text-slate-400">
              Non-zero amount
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <CircleDollarSign className="h-3.5 w-3.5" />
              Wallet balance
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {formatUsd(wallet?.balance || 0)}
            </div>
            <div className="mt-1 text-2xs text-slate-500 dark:text-slate-400">
              <Link
                href="/billing/wallet"
                className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                Manage wallet
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </Card>
        </div>

        {/* Filters row */}
        <Card className="p-4">
          <div className="flex flex-col gap-3">
            {/* Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {TX_FILTER_GROUPS.map((g) => {
                const isActive = filterId === g.id
                const count = filterCounts[g.id] || 0
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setFilterId(g.id)
                      setVisibleCount(PAGE_SIZE)
                    }}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                      isActive
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600',
                    ].join(' ')}
                  >
                    {g.label}
                    <span
                      className={[
                        'inline-flex items-center justify-center rounded-full px-1.5 text-xxs tabular-nums min-w-[18px] h-[18px]',
                        isActive
                          ? 'bg-white/15 dark:bg-slate-900/15'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
                      ].join(' ')}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search description…"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setVisibleCount(PAGE_SIZE)
                    }}
                    className="pl-8 h-8 w-44 sm:w-56 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSort((s) => (s === SORT_NEWEST ? SORT_OLDEST : SORT_NEWEST))
                  }
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {sort === SORT_NEWEST ? 'Newest' : 'Oldest'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBulkExport}
                  disabled={bulkExporting || eligibleCount === 0}
                  data-testid="bulk-export-pdf-button"
                  data-eligible-count={eligibleCount}
                  title={eligibleCount === 0 ? 'No chargeable invoices in the current view' : `Export ${eligibleCount} invoice${eligibleCount === 1 ? '' : 's'} as a single PDF`}
                >
                  {bulkExporting ? (
                    <ArrowUpRight className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  Export all (PDF)
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="p-0 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-slate-400" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
                No transactions match your filters
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Try clearing the search or switching to a different persona.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-left text-2xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="px-5 py-2.5 font-medium">Date</th>
                      <th className="px-3 py-2.5 font-medium">Description</th>
                      <th className="px-3 py-2.5 font-medium">Type</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Wallet</th>
                      <th className="px-5 py-2.5 font-medium text-right">Amount</th>
                      <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition"
                      >
                        <td className="px-5 py-3 align-top whitespace-nowrap">
                          <div className="text-sm text-slate-900 dark:text-white">
                            {formatTxDateShort(t.createdAt)}
                          </div>
                          <div className="text-2xs text-slate-500 dark:text-slate-400">
                            {formatTxTime(t.createdAt)}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="text-sm text-slate-900 dark:text-white">
                            {t.description || (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                          {t.planId && (
                            <div className="mt-0.5 text-2xs text-slate-500 dark:text-slate-400">
                              Plan: {t.planId}
                            </div>
                          )}
                          {t.lifetimeTierId && (
                            <div className="mt-0.5 text-2xs text-slate-500 dark:text-slate-400">
                              Tier: {t.lifetimeTierId.replace('lifetime_', '')}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <TransactionTypeBadge type={t.type} />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <TransactionStatusBadge status={t.status} />
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-slate-600 dark:text-slate-300 tabular-nums hidden lg:table-cell">
                          {typeof t.walletApplied === 'number' ? (
                            <>
                              <ArrowDownLeft className="inline h-3 w-3 text-emerald-500 mr-0.5" />
                              {formatUsd(t.walletApplied)}
                              {t.amountDue > 0 && (
                                <span className="block text-2xs text-slate-400 dark:text-slate-500">
                                  {formatUsd(t.amountDue)} due
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 align-top text-right whitespace-nowrap">
                          <div
                            className={[
                              'text-sm font-semibold tabular-nums',
                              t.amount > 0
                                ? 'text-slate-900 dark:text-white'
                                : t.amount < 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-400',
                            ].join(' ')}
                          >
                            {t.amount > 0 ? '+' : ''}
                            {formatUsd(t.amount)}
                          </div>
                          {t.amountDue > 0 && (
                            <div className="text-2xs text-slate-400 dark:text-slate-500">
                              {formatUsd(t.amountDue)} charged
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top text-right whitespace-nowrap">
                          <InvoicePdfButton tx={t} orgName={orgName} orgId={orgId} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer with load-more */}
              {hasMore ? (
                <div className="flex justify-center border-t border-slate-100 dark:border-slate-800 px-5 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  >
                    Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
                  </Button>
                </div>
              ) : (
                filtered.length > PAGE_SIZE && (
                  <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3 text-center text-2xs text-slate-500 dark:text-slate-400">
                    Showing {visible.length} of {filtered.length}
                  </div>
                )
              )}
            </>
          )}
        </Card>
      </div>
    </PageContainer>
  )
}
