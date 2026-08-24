'use client'

import { useEffect, useState } from 'react'
import {
  Cloud, Plus, CheckCircle2, AlertTriangle, ArrowRight, Server, Users, Layers, Search, X,
  Trash2,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { BulkActionTray } from '@/components/ui/bulk-action-tray'
import { LoadingState, PageContainer, PageHeader } from '@/components/ui/page'
import { showToast } from '@/utils/toast-utils'
import { cn } from '@/utils'

import { useCan } from '@/hooks/useCan'
import { useIsOwner } from '@/stores/organizationStore'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import * as api from '@/services/centralApi'
import { ProviderIntegrationsDialog } from '@/components/integrations/ProviderIntegrationsDialog'
import { RenameAccountDialog } from '@/components/integrations/RenameAccountDialog'
import { AccountActionsMenu } from '@/components/integrations/AccountActionsMenu'

/**
 * /integrations — manage cloud provider accounts for the active Org.
 *
 * Top of the page shows a stats overview (providers connected / total
 * accounts / total servers using these accounts) with a progress bar
 * that fills proportionally to providers connected. Below it the page
 * renders one section per provider from PROVIDER_CATALOG — whether
 * connected or not — so the layout is identical with 0, 1, or N
 * providers. Each section has a left accent stripe (indigo when
 * connected, slate when not) and a subtle hover state. Connected
 * providers show their accounts inline below the header; unconnected
 * ones show a small "Connect to enable server creation" hint instead
 * of a bare "Not connected" placeholder.
 *
 * Each account row shows the server count below the token preview so
 * the page is informative, not just a list of records.
 *
 * The connect dialog opens directly to the chosen provider's token
 * form (passes providerId straight to ProviderIntegrationsDialog). The
 * modal never shows a duplicate provider list here.
 */
export default function IntegrationsPage() {
  const canView = useCan('organization.provider.view')
  const canManage = useCan('organization.provider.manage')
  const isOwner = useIsOwner()
  const [connected, setConnected] = useState([])
  const [loading, setLoading] = useState(true)
  const [serverCounts, setServerCounts] = useState({}) // { [accountId]: number }

  // Search / filter — only renders the input when totalAccounts >= 3 (avoid clutter
  // below that threshold). Filters by label and token preview, client-side, no debounce.
  const [searchQuery, setSearchQuery] = useState('')

  // Connect dialog (providerId drives which provider's form shows).
  const [connectingProviderId, setConnectingProviderId] = useState(null)
  const [connectOpen, setConnectOpen] = useState(false)

  // Rename dialog (the account record being renamed).
  const [renamingAccount, setRenamingAccount] = useState(null)

  // Disconnect confirm (reuses the existing ConfirmDialog).
  const [disconnecting, setDisconnecting] = useState(null)
  const [disconnectBusy, setDisconnectBusy] = useState(false)
  const [serverCount, setServerCount] = useState(null)

  // Bulk-selection — mirrors the /servers pattern. Accounts are
  // selectable across search-filter changes (the row's checkbox state
  // is driven by `bulk.selection` membership, not by visibility in
  // the current visibleGroups). Bulk disconnect asks the confirm
  // dialog to skip accounts that still have servers attached (the
  // single-account guard already exists in disconnectProvider).
  const bulk = useBulkSelection()
  const [bulkDisconnectTarget, setBulkDisconnectTarget] = useState(null)
  //   bulkDisconnectTarget = null | { accountIds: string[], blockedIds: string[] }
  const [bulkDisconnecting, setBulkDisconnecting] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const list = await api.listProviders()
      setConnected(list)
      // Fan out server-count fetches in parallel for each account.
      const entries = await Promise.all(
        list.map(async (acc) => {
          try {
            const n = await api.countServersUsingProviderAccount(acc.id)
            return [acc.id, n]
          } catch {
            return [acc.id, 0]
          }
        })
      )
      setServerCounts(Object.fromEntries(entries))
    } catch (err) {
      showToast.error(err?.message || 'Failed to load providers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openConnect = (providerId) => {
    setConnectingProviderId(providerId)
    setConnectOpen(true)
  }

  const closeConnect = (next) => {
    setConnectOpen(next)
    if (!next) {
      // Reset the target so the next open always starts fresh.
      setConnectingProviderId(null)
    }
  }

  const openDisconnect = async (record) => {
    setDisconnecting(record)
    setServerCount(null)
    try {
      const n = await api.countServersUsingProviderAccount(record.id)
      setServerCount(n)
    } catch {}
  }

  const handleDisconnect = async () => {
    if (!disconnecting) return
    setDisconnectBusy(true)
    try {
      await api.disconnectProvider(disconnecting.id)
      showToast.success(`${api.PROVIDER_CATALOG.find((p) => p.id === disconnecting.provider)?.name || 'Provider'} disconnected`)
      setDisconnecting(null)
      setServerCount(null)
      await load()
    } catch (err) {
      showToast.error(err?.message || 'Failed to disconnect provider')
    } finally {
      setDisconnectBusy(false)
    }
  }

  // Bulk disconnect — pre-flight check separates accounts with
  // servers attached from those free to drop. The confirm dialog
  // surfaces both groups so the user knows exactly what will and
  // won't happen before they click. Disconnects happen sequentially
  // via the existing api.disconnectProvider (each one fires its own
  // audit entry, so the audit log shows the full per-account trace).
  const openBulkDisconnect = () => {
    if (bulk.count === 0) return
    const accountIds = Array.from(bulk.selection)
    const blockedIds = accountIds.filter((id) => (serverCounts[id] || 0) > 0)
    setBulkDisconnectTarget({ accountIds, blockedIds })
  }
  const handleBulkDisconnect = async () => {
    if (!bulkDisconnectTarget) return
    setBulkDisconnecting(true)
    try {
      const { accountIds, blockedIds } = bulkDisconnectTarget
      const okIds = accountIds.filter((id) => !blockedIds.includes(id))
      let okCount = 0
      let failCount = 0
      for (const id of okIds) {
        try {
          await api.disconnectProvider(id)
          okCount += 1
        } catch {
          failCount += 1
        }
      }
      if (okCount > 0) {
        showToast.success(
          okCount === 1
            ? `Disconnected 1 account${blockedIds.length ? ` (${blockedIds.length} skipped — still in use)` : ''}`
            : `Disconnected ${okCount} accounts${blockedIds.length ? ` (${blockedIds.length} skipped — still in use)` : ''}`
        )
      }
      if (failCount > 0) {
        showToast.error(`Failed to disconnect ${failCount} ${failCount === 1 ? 'account' : 'accounts'}`)
      }
      bulk.clear()
      setBulkDisconnectTarget(null)
      await load()
    } catch (err) {
      showToast.error(err?.message || 'Failed to disconnect accounts')
    } finally {
      setBulkDisconnecting(false)
    }
  }

  if (!canView) {
    return (
      <PageContainer size="md">
        <Card className="p-10 sm:p-12 text-center">
          <Cloud className="h-10 w-10 mx-auto text-slate-400 dark:text-slate-500" />
          <h3 className="font-semibold text-slate-900 dark:text-white mt-4">No access</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            You don&apos;t have permission to view provider integrations in this organization.
          </p>
        </Card>
      </PageContainer>
    )
  }

  const groups = api.PROVIDER_CATALOG.map((p) => ({
    provider: p,
    accounts: connected.filter((c) => c.provider === p.id),
  }))
  const totalProviders = api.PROVIDER_CATALOG.length
  const connectedProviders = groups.filter((g) => g.accounts.length > 0).length
  const totalAccounts = connected.length
  const totalServers = Object.values(serverCounts).reduce((a, b) => a + (b || 0), 0)
  const connectedPct = totalProviders === 0 ? 0 : Math.round((connectedProviders / totalProviders) * 100)

  // Search visibility — with a query, only providers that have at least one matching
  // account are shown. Each provider's accounts list is also filtered to the matching
  // subset (by label OR token preview), and providers end up with zero accounts dropped.
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const searchActive = normalizedQuery.length > 0
  const accountMatches = (acc) => {
    if (!normalizedQuery) return true
    const lbl = (acc.label || '').toLowerCase()
    const tok = (acc.tokenPreview || '').toLowerCase()
    return lbl.includes(normalizedQuery) || tok.includes(normalizedQuery)
  }
  const visibleGroups = searchActive
    ? groups
        .map((g) => ({ provider: g.provider, accounts: g.accounts.filter(accountMatches) }))
        .filter((g) => g.accounts.length > 0)
    : groups
  const noSearchResults = searchActive && visibleGroups.length === 0

  return (
    <PageContainer
      size="md"
      className={cn(
        'space-y-6 relative transition-[padding-bottom] duration-200',
        // Push content up when the BulkActionTray is open so the demo
        // notice (and the last provider card) aren't hidden behind the
        // fixed-position tray. Mirrors /servers' pattern.
        bulk.count > 0 && 'pb-28 sm:pb-24',
      )}
    >
      {/* Subtle background wash — radial gradient at top adds depth without competing with content. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,theme(colors.slate.200/.55),transparent_70%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,theme(colors.indigo.500/.12),transparent_70%)]"
      />

      <PageHeader
        eyebrow="Integrations"
        title="Cloud providers"
        description="Connect accounts so Central Panel can create VPS instances directly. This frontend demo does not send credentials to a real provider or store real provider secrets — only a last-4 preview is kept locally."
      />

      {loading ? (
        <LoadingState label="Loading providers…" />
      ) : (
        <>
          {/* Empty-state panel — shown only when 0 accounts are connected. Anchors
              first-time setup with a system-status heading, a 3-step micro-explainer,
              and a primary CTA that opens the first provider's connect form. Per
              NN/g "Designing Empty States" (3 guidelines): communicate status +
              provide learning cue + provide direct pathway. The stats card and
              provider list still render below so the user can also browse. */}
          {totalAccounts === 0 && (
            <Card className="p-5 sm:p-7 border-slate-200/80 dark:border-slate-700/60 shadow-sm bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/40 dark:from-indigo-500/10 dark:via-slate-900 dark:to-violet-500/10">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-500/15 px-2.5 py-1 rounded-full">
                  <Cloud className="h-3.5 w-3.5" />
                  Get started
                </div>
                <h2 className="mt-3 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                  Connect a cloud provider
                </h2>
                <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  Central Panel creates VPS instances through a connected provider. Add a token to get started — only the last 4 characters are stored.
                </p>
                <ol className="mt-5 space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
                  <li className="flex items-start gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center" aria-hidden>1</span>
                    <span>Generate a provider API token from your provider&apos;s site</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center" aria-hidden>2</span>
                    <span>Paste it here — Central Panel stores only the last 4 characters</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center" aria-hidden>3</span>
                    <span>Use it from the Create Server wizard</span>
                  </li>
                </ol>
                {canManage && api.PROVIDER_CATALOG[0] && (
                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      onClick={() => openConnect(api.PROVIDER_CATALOG[0].id)}
                      className="gap-2"
                      data-testid="connect-first-provider"
                    >
                      <Plus className="h-4 w-4" />
                      Connect your first provider
                    </Button>
                    <a
                      href="#providers-below"
                      className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline-offset-2 hover:underline"
                    >
                      Browse all providers below →
                    </a>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Stats overview — at-a-glance summary + progress bar. */}
          <Card className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-700/60 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <StatTile
                icon={Layers}
                label="Providers"
                value={
                  <>
                    {connectedProviders}
                    <span className="text-slate-400 dark:text-slate-500 text-lg font-medium"> / {totalProviders}</span>
                  </>
                }
                accent="indigo"
              />
              <StatTile
                icon={Users}
                label="Accounts"
                value={totalAccounts}
                accent="emerald"
              />
              <StatTile
                icon={Server}
                label="Servers"
                value={totalServers}
                accent="amber"
              />
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {connectedPct === 100
                    ? 'All providers connected'
                    : connectedProviders === 0
                      ? 'No providers connected yet'
                      : `${connectedPct}% of providers connected`}
                </p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  {connectedProviders}/{totalProviders}
                </p>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    connectedPct === 100
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                      : "bg-gradient-to-r from-indigo-500 to-indigo-600"
                  )}
                  style={{ width: `${connectedPct}%` }}
                  role="progressbar"
                  aria-valuenow={connectedPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          </Card>

          <div id="providers-below" className="space-y-4">
            {/* Search / filter input — only renders when 3+ accounts exist. Filters
                by label and token preview, client-side. */}
            {totalAccounts >= 3 && (
              <div className="flex items-center gap-3">
                <label htmlFor="integrations-search" className="sr-only">
                  Filter accounts
                </label>
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" aria-hidden />
                  <Input
                    id="integrations-search"
                    type="search"
                    placeholder="Filter by label or token…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {searchActive && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      aria-label="Clear filter"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {searchActive && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {visibleGroups.reduce((sum, g) => sum + g.accounts.length, 0)} match{visibleGroups.reduce((sum, g) => sum + g.accounts.length, 0) === 1 ? '' : 'es'}
                  </span>
                )}
              </div>
            )}

            {/* Provider list — filtered when searchActive. Empty-results state replaces
                the list when no accounts match the query. */}
            {noSearchResults ? (
              <Card className="p-6 sm:p-8 border-slate-200/80 dark:border-slate-700/60 shadow-sm text-center">
                <Search className="h-7 w-7 mx-auto text-slate-400 dark:text-slate-500" aria-hidden />
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  No accounts match &ldquo;<span className="font-mono font-semibold text-slate-900 dark:text-white">{searchQuery}</span>&rdquo;.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="mt-4"
                >
                  Clear filter
                </Button>
              </Card>
            ) : (searchActive ? visibleGroups : groups).map(({ provider, accounts }) => {
              const isConnected = accounts.length > 0
              return (
                <section
                  key={provider.id}
                  className={cn(
                    "relative rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden",
                    "transition-all duration-200",
                    "border-slate-200 dark:border-slate-700/70",
                    "hover:border-slate-300 dark:hover:border-slate-600 dark:hover:border-slate-600 hover:shadow-sm",
                    // Left accent stripe — 3px wide, indigo if connected, slate if not.
                    isConnected
                      ? "border-l-[3px] border-l-indigo-500"
                      : "border-l-[3px] border-l-slate-200 dark:border-l-slate-700"
                  )}
                >
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className="h-12 w-12 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-base font-bold ring-1 ring-inset ring-slate-200/70 dark:ring-slate-700/70"
                        aria-hidden
                      >
                        {provider.name[0]}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 dark:text-white truncate text-[15px]">
                            {provider.name}
                          </h3>
                          {accounts.length > 0 && (
                            <span className="text-2xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5">
                              {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
                            </span>
                          )}
                        </div>
                        {accounts.length === 0 ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <ArrowRight className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Connect to enable server creation
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {canManage && (
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => openConnect(provider.id)}
                        className="gap-2 px-3.5 shrink-0"
                        data-testid={`add-account-${provider.id}`}
                      >
                        <Plus className="h-4 w-4" />
                        Connect
                      </Button>
                    )}
                  </div>

                  {accounts.length > 0 && (
                    <ul className="border-t border-slate-200 dark:border-slate-700/70 divide-y divide-slate-200 dark:divide-slate-700/70">
                      {accounts.map((acc) => {
                        const count = serverCounts[acc.id]
                        // Freshness signal — surfaces the "is this working?" question
                        // for accounts that have never been used to create a server.
                        // Grounded in NN/g #1 (system status) and the GitHub PAT pattern
                        // of surfacing inactivity. Computed from connectedAt + server
                        // count; a fresh account with no servers reads "New", an old
                        // account with no servers reads "Idle", everything else keeps
                        // the existing "Connected" badge.
                        const accAgeMs = Date.now() - new Date(acc.connectedAt).getTime()
                        const hasNoUsage = (count || 0) === 0
                        const freshness = accAgeMs < 60 * 60 * 1000 && hasNoUsage
                          ? {
                              label: 'New',
                              ariaLabel: 'Awaiting first use — connected within the last hour, no servers using this account yet',
                              className: 'inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10',
                            }
                          : accAgeMs > 30 * 24 * 60 * 60 * 1000 && hasNoUsage
                            ? {
                                label: 'Idle',
                                ariaLabel: 'Idle — connected over 30 days ago, no servers using this account',
                                className: 'inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800',
                              }
                            : null
                        return (
                          <li key={acc.id} className="flex items-center gap-3 px-5 py-3.5">
                            {canManage && (
                              <input
                                type="checkbox"
                                role="checkbox"
                                aria-label={`Select ${acc.label} for bulk actions`}
                                checked={bulk.selection.has(acc.id)}
                                onChange={() => bulk.toggle(acc.id)}
                                disabled={(serverCounts[acc.id] || 0) > 0}
                                title={(serverCounts[acc.id] || 0) > 0 ? 'In use by a server — disconnect the server first' : undefined}
                                className="h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium text-slate-900 dark:text-white truncate">
                                  {acc.label}
                                </h4>
                                <span className="inline-flex items-center gap-1 text-2xs font-medium text-emerald-700 dark:text-emerald-300">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Connected
                                </span>
                                {freshness && (
                                  <span
                                    className={cn('rounded-full px-2 py-0.5 text-2xs font-medium', freshness.className)}
                                    aria-label={freshness.ariaLabel}
                                  >
                                    {freshness.label}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                <span className="font-mono">{acc.tokenPreview}</span>
                                <span className="mx-1.5">·</span>
                                connected {new Date(acc.connectedAt).toLocaleString()}
                              </p>
                              {typeof count === 'number' && count > 0 && (
                                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 inline-flex items-center gap-1.5">
                                  <Server className="h-3 w-3" />
                                  {count} {count === 1 ? 'server' : 'servers'} using this account
                                </p>
                              )}
                            </div>
                            {canManage && (
                              <AccountActionsMenu
                                label={`Actions for ${acc.label}`}
                                onRename={() => setRenamingAccount(acc)}
                                onDisconnect={() => openDisconnect(acc)}
                              />
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        </>
      )}

      <Card className="p-4 border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-900 dark:text-amber-200">
            <span className="font-semibold">Demo notice.</span>{' '}
            This is a frontend-only demo. Central Panel does not send credentials to a
            real provider, does not store real provider tokens, and does not create real
            VPS instances here. The Create Server wizard uses simulated delays and mock
            progress states so the UX can be evaluated end-to-end before the real
            backend wiring lands.
          </p>
        </div>
      </Card>

      <ProviderIntegrationsDialog
        open={connectOpen}
        providerId={connectingProviderId}
        onOpenChange={closeConnect}
        onConnected={load}
      />

      <RenameAccountDialog
        open={!!renamingAccount}
        onOpenChange={(o) => !o && setRenamingAccount(null)}
        account={renamingAccount}
        onSuccess={load}
      />

      <ConfirmDialog
        open={!!disconnecting}
        onOpenChange={(o) => !o && setDisconnecting(null)}
        title="Disconnect account?"
        description={
          disconnecting
            ? serverCount && serverCount > 0
              ? `Can't disconnect — ${serverCount} server${serverCount === 1 ? '' : 's'} still use this account. Reconnect each server to a different account first, then disconnect.`
              : `Disconnect ${api.PROVIDER_CATALOG.find((p) => p.id === disconnecting.provider)?.name || 'this provider'} account "${disconnecting.label}"? Existing servers created with this account will keep working until they're re-assigned.`
            : ''
        }
        confirmText={serverCount && serverCount > 0 ? 'Got it' : 'Disconnect'}
        variant={serverCount && serverCount > 0 ? 'default' : 'destructive'}
        loading={disconnectBusy}
        onConfirm={() => {
          if (serverCount && serverCount > 0) {
            setDisconnecting(null)
            setServerCount(null)
            return
          }
          handleDisconnect()
        }}
      />

      <ConfirmDialog
        open={!!bulkDisconnectTarget}
        onOpenChange={(o) => { if (!o && !bulkDisconnecting) setBulkDisconnectTarget(null) }}
        title={
          bulkDisconnectTarget?.blockedIds.length
            ? `Disconnect ${bulkDisconnectTarget.accountIds.length - bulkDisconnectTarget.blockedIds.length} of ${bulkDisconnectTarget.accountIds.length} accounts?`
            : `Disconnect ${bulkDisconnectTarget?.accountIds.length ?? 0} accounts?`
        }
        description={
          bulkDisconnectTarget?.blockedIds.length
            ? `${bulkDisconnectTarget.blockedIds.length} of the selected accounts are still in use by servers and will be skipped. The remaining ${bulkDisconnectTarget.accountIds.length - bulkDisconnectTarget.blockedIds.length} will be disconnected. Existing servers created with these accounts will keep working until they're re-assigned.`
            : 'These accounts will be disconnected. Existing servers created with them will keep working until they\'re re-assigned.'
        }
        confirmText="Disconnect"
        variant="destructive"
        loading={bulkDisconnecting}
        onConfirm={handleBulkDisconnect}
      />

      {/* Bulk action tray — fixed bottom. Only renders when 1+ accounts
          selected. Disabled state surfaces the canManage gate. The single
          action is "Disconnect N accounts" which opens the bulk confirm
          above. The tray's own chips + clear button handle the rest of
          the bulk UX (matches /servers and /members). */}
      {canManage && totalAccounts > 0 && (
        <BulkActionTray
          rowIds={Array.from(bulk.selection)}
          rows={connected}
          getRowLabel={(acc) => acc.label}
          getRowSubLabel={(acc) => {
            const provider = api.PROVIDER_CATALOG.find((p) => p.id === acc.provider)
            return provider?.name || null
          }}
          hasHiddenSelection={false}
          onRemove={(id) => bulk.remove(id)}
          onClear={() => bulk.clear()}
          currentUser={{ isOwner, canManage }}
          rowNounSingular="account"
          rowNounPlural="accounts"
          actions={[
            {
              id: 'bulkDisconnectAccounts',
              label: bulk.count === 1 ? 'Disconnect account' : `Disconnect ${bulk.count} accounts`,
              icon: Trash2,
              destructive: true,
              onClick: openBulkDisconnect,
            },
          ]}
        />
      )}
    </PageContainer>
  )
}

/**
 * StatTile — one big number + small label inside the stats overview card.
 * The accent prop picks a Tailwind text color for the icon; the gradient
 * bar in the parent handles the visual emphasis.
 */
function StatTile({ icon: Icon, label, value, accent = 'indigo' }) {
  const accentText = {
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
  }[accent]

  return (
    <div className="flex items-center gap-3">
      <span className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", accentText)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
          {label}
        </p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums leading-tight mt-0.5">
          {value}
        </p>
      </div>
    </div>
  )
}