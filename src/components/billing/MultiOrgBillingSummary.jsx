'use client'

import { Server as ServerIcon, Wallet, Calendar, ArrowRight, AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useOrganizationStore } from '@/stores/organizationStore'

// MultiOrgBillingSummary — top-of-Overview card for users who belong to
// more than one organization. Single-org users see no summary (the
// Overview's own hero block already covers their case).
//
// Renders a per-org row with: plan, status, next renewal, monthly price,
// server count, wallet. Footer row aggregates: total monthly cost,
// combined wallet, total servers, and a warning badge when any org is
// over its server limit.
//
// Clicking a row sets the active org via the existing store action.
// Highlight ring + "Active" badge mark the current org so users can
// see which one they're looking at.
//
// Tagged with data-testid for the verify suite:
//   - multi-org-summary        (root)
//   - multi-org-row-<orgId>    (one row per org)
//   - multi-org-totals-monthly (footer total monthly cost)
//   - multi-org-totals-wallet  (footer combined wallet)
//   - multi-org-warning        (when any org is over-limit)
function fmtUsd(n) {
  return `$${(Number(n) || 0).toFixed(2)}`
}
function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

const STATUS_VARIANT = {
  success: 'success',
  info: 'info',
  warning: 'warning',
  neutral: 'secondary',
}

export function MultiOrgBillingSummary({ summary, onSwitchOrg }) {
  if (!summary) return null
  const { orgs, totals } = summary
  if (!orgs || orgs.length <= 1) return null // single-org users don't need this

  return (
    <Card
      data-testid="multi-org-summary"
      className="p-5 border-indigo-200 dark:border-indigo-500/40 bg-gradient-to-br from-indigo-50/40 via-white to-white dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Billing across {orgs.length} organizations
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
            Combined billing summary
          </h3>
        </div>
        {totals.overLimitCount > 0 && (
          <div
            data-testid="multi-org-warning"
            className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 px-2.5 py-1 text-xs font-medium"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {totals.overLimitCount} org{totals.overLimitCount === 1 ? '' : 's'} over server limit
          </div>
        )}
      </div>

      {/* Per-org rows */}
      <div className="mt-4 divide-y divide-slate-200/70 dark:divide-slate-700/70 -mx-2">
        {orgs.map((r) => (
          <button
            key={r.orgId}
            type="button"
            data-testid={`multi-org-row-${r.orgId}`}
            onClick={() => onSwitchOrg && onSwitchOrg(r.orgId)}
            className={cn(
              'w-full text-left px-3 py-3 rounded-lg transition-colors',
              'hover:bg-slate-50 dark:hover:bg-slate-800/40',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              r.isActive && 'bg-indigo-50/60 dark:bg-indigo-950/30 ring-1 ring-indigo-200 dark:ring-indigo-500/40'
            )}
            aria-label={`Switch to ${r.orgName}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900 dark:text-white truncate">
                    {r.orgName}
                  </span>
                  <Badge variant={STATUS_VARIANT[r.statusTone] || 'secondary'}>
                    {r.statusLabel}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 truncate">
                  {r.planName}
                  {r.serverLimit != null
                    ? ` · ${r.serverCount}/${r.serverLimit} servers`
                    : ` · ${r.serverCount} server${r.serverCount === 1 ? '' : 's'}`}
                  {r.overLimit && (
                    <span className="ml-2 text-red-700 dark:text-red-300 font-medium">
                      (over limit)
                    </span>
                  )}
                  {!r.overLimit && r.approachingLimit && (
                    <span className="ml-2 text-amber-700 dark:text-amber-300 font-medium">
                      (almost full)
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {fmtUsd(r.monthlyPriceUsd)}/mo
                </p>
                {r.nextRenewalAt && r.monthlyPriceUsd > 0 && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {fmtDate(r.nextRenewalAt)}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer totals */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-200/70 dark:border-slate-700/70">
        <div className="rounded-lg bg-white/70 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-700/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Wallet className="h-3.5 w-3.5" />
            <span>Combined wallet</span>
          </div>
          <p
            data-testid="multi-org-totals-wallet"
            className="mt-1 text-lg font-semibold text-slate-900 dark:text-white"
          >
            {fmtUsd(totals.walletUsd)}
          </p>
        </div>
        <div className="rounded-lg bg-white/70 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-700/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Calendar className="h-3.5 w-3.5" />
            <span>Monthly total</span>
          </div>
          <p
            data-testid="multi-org-totals-monthly"
            className="mt-1 text-lg font-semibold text-slate-900 dark:text-white"
          >
            {fmtUsd(totals.monthlyUsd)}
            <span className="text-sm text-slate-500 dark:text-slate-400 font-normal">/mo</span>
          </p>
        </div>
        <div className="rounded-lg bg-white/70 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-700/70 p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ServerIcon className="h-3.5 w-3.5" />
            <span>Total servers</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
            {totals.servers}
            {totals.overLimitCount > 0 && (
              <span className="ml-2 text-xs font-medium text-red-700 dark:text-red-300">
                ({totals.overLimitCount} over)
              </span>
            )}
          </p>
        </div>
      </div>
    </Card>
  )
}

// Convenience hook: pulls summary + wires up the org switcher using the
// existing store. Keeps the wiring localized.
export function useMultiOrgBillingSummary() {
  const setActive = useOrganizationStore((s) => s.setActive)
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  return {
    activeOrgId,
    switchOrg: async (orgId) => {
      if (!orgId || orgId === activeOrgId) return
      try { await setActive(orgId) } catch {}
    },
  }
}
