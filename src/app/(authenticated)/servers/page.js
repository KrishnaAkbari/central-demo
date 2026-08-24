'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Plus, Server as ServerIcon, KeyRound, Globe, Cpu, MemoryStick,
  Cloud, Terminal, Search as SearchIcon, LayoutGrid, List, ChevronRight,
  ExternalLink, Copy, Check, Activity, Share2 as ShareIcon,
  PlugZap, RefreshCw, Tag as TagIcon, Eye, ArrowRight, Beaker,
  AlertTriangle, XCircle,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { TypeaheadInput } from '@/components/ui/typeahead-input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatRow } from '@/components/primitives/StatRow'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { LoadingState, PageContainer, PageHeader } from '@/components/ui/page'
import { showToast } from '@/utils/toast-utils'
import { cn } from '@/utils'

import { useOrganizationStore, useIsOwner } from '@/stores/organizationStore'
import { useCan } from '@/hooks/useCan'
import * as api from '@/services/centralApi'

import { ServerActionsMenu } from '@/components/servers/ServerActionsMenu'
import { SourcePickerCards } from '@/components/servers/CreateServer/SourcePickerCards'
import { ServerShareDialog } from './ServerShareDialog'
import { BulkActionTray } from '@/components/ui/bulk-action-tray'
import { bulkActionEligibility } from '@/lib/bulk-eligibility'
import { useBulkSelection } from '@/hooks/useBulkSelection'

// --- Health classification (mirrors the dashboard helper — duplicate is
// intentional; if a third page needs this, lift to src/utils/health.js) ---
function classifyHealth(server) {
  const cpu = server?.cpu?.loadPct ?? 0
  const memPct = server?.memory?.totalMb
    ? Math.round(((server.memory.usedMb || 0) / server.memory.totalMb) * 100)
    : 0
  if (cpu >= 90 || memPct >= 95) return 'error'
  if (cpu >= 70 || memPct >= 80) return 'warning'
  return 'healthy'
}

// isDemoData — true when /dashboard's seedDemoData() has been run.
// Demo servers all have ids prefixed with `demo_`, and the seed creates
// a `demo_provider_vultr` provider. We check for either signal so the
// banner shows even if the user has partially cleaned up.
function isDemoData(servers) {
  if (!Array.isArray(servers)) return false
  return servers.some((s) => typeof s.id === 'string' && s.id.startsWith('demo_'))
}

// seedDemoData — populates the active org with 5 demo servers + 1 demo
// provider + 2 demo audit entries, then reloads the page. Mirrors
// /dashboard's seedDemoData() so the demo experience is identical
// regardless of which surface the user clicks the link from.
//
// Duplicated inline rather than imported from /dashboard/page.js because
// /dashboard exports its component, not its helpers. Keeping the seed +
// clear helpers in the same file makes the demo-data flow self-contained
// and easy to reason about.
function seedDemoData() {
  if (typeof window === 'undefined') return
  const orgId = window.localStorage.getItem('cp_active_org')
  const authRaw = window.localStorage.getItem('cp_auth')
  if (!orgId || !authRaw) return

  let auth
  try { auth = JSON.parse(authRaw) } catch { return }
  const userId = auth?.userId
  const userEmail = auth?.userEmail || 'demo@central.local'

  const now = new Date().toISOString()
  const providerId = 'demo_provider_vultr'
  const provider = {
    id: providerId,
    orgId,
    provider: 'vultr',
    label: 'Demo · Vultr',
    apiKey: 'DEMO-DO-NOT-USE',
    createdAt: now,
    lastSyncAt: now,
  }
  const existingProviders = JSON.parse(window.localStorage.getItem('cp_providers') || '[]')
  const nextProviders = [
    ...existingProviders.filter((p) => p.id !== providerId),
    provider,
  ]
  window.localStorage.setItem('cp_providers', JSON.stringify(nextProviders))

  const servers = [
    {
      id: 'demo_cache_01', name: 'cache-01', hostname: 'cache-01.fra1.example.com',
      region: 'fra1', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 95 }, memory: { usedMb: 3800, totalMb: 4000 },
      connectedAt: now, connectedById: userId,
    },
    {
      id: 'demo_db_01', name: 'db-01', hostname: 'db-01.nyc3.example.com',
      region: 'nyc3', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 78 }, memory: { usedMb: 3300, totalMb: 4000 },
      connectedAt: now, connectedById: userId,
    },
    {
      id: 'demo_web_01', name: 'web-01', hostname: 'web-01.nyc3.example.com',
      region: 'nyc3', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 45 }, memory: { usedMb: 1150, totalMb: 4000 },
      connectedAt: now, connectedById: userId,
    },
    {
      id: 'demo_api_01', name: 'api-01', hostname: 'api-01.sfo2.example.com',
      region: 'sfo2', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 12 }, memory: { usedMb: 800, totalMb: 4000 },
      connectedAt: now, connectedById: userId,
    },
    {
      id: 'demo_worker_01', name: 'worker-01', hostname: 'worker-01.fra1.example.com',
      region: 'fra1', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 22 }, memory: { usedMb: 950, totalMb: 4000 },
      connectedAt: now, connectedById: userId,
    },
  ]
  const existingServers = JSON.parse(window.localStorage.getItem('cp_servers') || '[]')
  const demoIds = new Set(servers.map((s) => s.id))
  const nextServers = [
    ...existingServers.filter((s) => !demoIds.has(s.id)),
    ...servers,
  ]
  window.localStorage.setItem('cp_servers', JSON.stringify(nextServers))

  const audit = [
    {
      id: 'demo_audit_1', action: 'server.create', actorEmail: userEmail,
      target: 'cache-01', at: new Date(Date.now() - 3600_000).toISOString(),
      orgId,
    },
    {
      id: 'demo_audit_2', action: 'provider.connect', actorEmail: userEmail,
      target: 'Vultr (Demo)', at: new Date(Date.now() - 86_400_000).toISOString(),
      orgId,
    },
  ]
  const existingAudit = JSON.parse(window.localStorage.getItem('cp_audit') || '[]')
  const demoAuditIds = new Set(audit.map((a) => a.id))
  const nextAudit = [
    ...existingAudit.filter((a) => !demoAuditIds.has(a.id)),
    ...audit,
  ]
  window.localStorage.setItem('cp_audit', JSON.stringify(nextAudit))
}

const HEALTH_META = {
  healthy: { border: 'border-l-emerald-500', dot: 'bg-emerald-500', label: 'healthy', badge: 'success' },
  warning: { border: 'border-l-amber-500',   dot: 'bg-amber-500',   label: 'warning', badge: 'warning' },
  error:   { border: 'border-l-red-500',     dot: 'bg-red-500',     label: 'error',   badge: 'destructive' },
  unknown: { border: 'border-l-slate-300 dark:border-l-slate-700', dot: 'bg-slate-400', label: 'unknown', badge: 'secondary' },
}

function SourceIcon({ source }) {
  // Quiet icon-only marker for how a server was added. After install all
  // servers are Open Source Panel servers, so the source is incidental — a
  // small icon next to the region is enough. Title attribute gives a tooltip
  // for users who want to know more.
  if (source === 'provider') {
    return (
      <Cloud
        className="h-3 w-3 text-sky-600 dark:text-sky-400"
        title="Provisioned via cloud provider"
        aria-label="Provisioned via cloud provider"
      />
    )
  }
  if (source === 'custom_vps') {
    return (
      <Terminal
        className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
        title="Connected via SSH"
        aria-label="Connected via SSH"
      />
    )
  }
  return (
    <KeyRound
      className="h-3 w-3 text-indigo-600 dark:text-indigo-400"
      title="Connected via management key"
      aria-label="Connected via management key"
    />
  )
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}

const STATUS_FILTERS = [
  { id: 'all',     label: 'All',     countKey: 'all' },
  { id: 'healthy', label: 'Healthy', countKey: 'healthy' },
  { id: 'warning', label: 'Warning', countKey: 'warning' },
  { id: 'error',   label: 'Error',   countKey: 'error' },
]

const STATUS_DOT = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error:   'bg-red-500',
}

const SORT_OPTIONS = [
  { id: 'recent', label: 'Recently added' },
  { id: 'name',   label: 'Name (A→Z)' },
  { id: 'region', label: 'Region' },
  { id: 'status', label: 'Status' },
]

export default function ServersPage() {
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  const canView = useCan('organization.servers.view')
  const canManage = useCan('organization.servers.manage')
  const isOwner = useIsOwner()
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)

  // UI state — single bag of filter/sort/view state
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState('grid')

  // Bulk-selection state. Lives at the page level so the cards/rows,
  // the "Select all matching" link, and the BulkActionTray all see the
  // same selection. The hook is filter-aware: selection survives a
  // filter change so the user can move between views without losing
  // their batch.
  const bulk = useBulkSelection()

  // Share dialog target. Lifted from a single-server {server} shape to
  // a unified {mode, serverIds, serverNames} so the page renders ONE
  // dialog for both per-row share and bulk share flows. `mode` is
  // mostly informational today (toast copy uses it) but reserves the
  // shape for future "edit access" multi-server flows.
  const [shareTarget, setShareTarget] = useState(null)
  //   shareTarget = null | {
  //     mode: 'single' | 'bulk',
  //     serverIds: string[],
  //     serverNames: string[],
  //   }

  // Bulk disconnect target — mirrors shareTarget's shape but routes to
  // a destructive ConfirmDialog instead of the share modal. Single
  // object so the page only renders ONE confirm at a time. `busy`
  // tracks the in-flight request so the dialog can show a spinner and
  // prevent re-entry / dismiss-while-loading.
  const [bulkDisconnectTarget, setBulkDisconnectTarget] = useState(null)
  //   bulkDisconnectTarget = null | { serverIds: string[], serverNames: string[] }
  const [bulkDisconnecting, setBulkDisconnecting] = useState(false)

  // Demo-mode banner — visible above the toolbar when /dashboard's
  // seedDemoData() has been run (4 demo servers + 1 demo provider
  // present in localStorage). The dismiss flag is per-session so the
  // banner reappears next visit until the user actually clears data.
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false)
  const dismissDemoBanner = () => setDemoBannerDismissed(true)
  const handleClearDemoData = () => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem('cp_servers')
      const list = raw ? JSON.parse(raw) : []
      const kept = list.filter((s) => !(s.id || '').startsWith('demo_'))
      window.localStorage.setItem('cp_servers', JSON.stringify(kept))
      const pRaw = window.localStorage.getItem('cp_providers')
      const providers = pRaw ? JSON.parse(pRaw) : []
      const keptProviders = providers.filter((p) => p.id !== 'demo_provider_vultr')
      window.localStorage.setItem('cp_providers', JSON.stringify(keptProviders))
      window.location.reload()
    } catch {
      // ignore — reload still happens below
      window.location.reload()
    }
  }
  const handleSeedDemo = () => {
    seedDemoData()
    if (typeof window !== 'undefined') window.location.reload()
  }

  const loadServers = async () => {
    try {
      const s = await api.listServers()
      setServers(s)
    } catch (err) {
      showToast.error(err?.message || 'Failed to load servers')
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        await loadServers()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeOrgId])

  // Precompute health counts so the chip strip shows a live distribution
  // ("Healthy 3 / Warning 1 / Error 0"). Independent of the active chip and
  // search so the chip counts reflect what you'd get if you clicked each one.
  const healthCounts = useMemo(() => {
    const counts = { all: servers.length, healthy: 0, warning: 0, error: 0 }
    for (const s of servers) {
      const h = classifyHealth(s)
      counts[h] = (counts[h] || 0) + 1
    }
    return counts
  }, [servers])

  // Typeahead suggestions — all server names in scope for the search popover
  const serverNames = useMemo(
    () => servers.map((s) => s.name || '').filter(Boolean),
    [servers]
  )

  // Derived list — filter then sort
  const filteredServers = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = servers
    // Filter by health
    if (filter === 'healthy') list = list.filter((s) => classifyHealth(s) === 'healthy')
    else if (filter === 'warning') list = list.filter((s) => classifyHealth(s) === 'warning')
    else if (filter === 'error') list = list.filter((s) => classifyHealth(s) === 'error')
    // Filter by search
    if (q) {
      list = list.filter((s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.hostname || '').toLowerCase().includes(q)
      )
    }
    // Sort
    const sorted = [...list]
    if (sort === 'name') {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    } else if (sort === 'region') {
      sorted.sort((a, b) => (a.region || '').localeCompare(b.region || ''))
    } else if (sort === 'status') {
      const order = { error: 0, warning: 1, healthy: 2, unknown: 3 }
      sorted.sort((a, b) => order[classifyHealth(a)] - order[classifyHealth(b)])
    } else {
      // recent — by connectedAt desc
      sorted.sort((a, b) => new Date(b.connectedAt || 0) - new Date(a.connectedAt || 0))
    }
    return sorted
  }, [servers, search, filter, sort])

  // Visible row id list — used by the BulkActionTray to know what's
  // "in view" for the hidden-by-filter hint and by the Ctrl/Cmd+A
  // shortcut for select-all-visible.
  const filteredIds = useMemo(
    () => filteredServers.map((s) => s.id),
    [filteredServers],
  )
  const hasHiddenSelection = useMemo(
    () => bulk.hasHiddenSelection(filteredIds),
    [bulk, filteredIds],
  )

  // selectedRows — the actual server objects in selection-order. Used
  // by BulkActionTray so chips render real names, not raw ids. The
  // order walks bulk.selection (insertion order) which matches the
  // Gmail convention: items appear in the tray in the order they were
  // added.
  const selectedRows = useMemo(() => {
    const byId = new Map(filteredServers.map((s) => [s.id, s]))
    // Also include any selected server that's hidden by filter so the
    // tray can still render its chip.
    const allById = new Map(servers.map((s) => [s.id, s]))
    const rows = []
    for (const id of bulk.selection) {
      const r = byId.get(id) || allById.get(id)
      if (r) rows.push(r)
    }
    return rows
  }, [bulk.selection, filteredServers, servers])

  // Keyboard shortcuts (only active when there's an active selection):
  //   Esc          — clear the selection (ignored inside text inputs).
  //   Ctrl/Cmd+A   — select every currently-visible row. Skipped when
  //                  a text input is focused so users can still select
  //                  text in the search box.
  useEffect(() => {
    if (bulk.count === 0) return
    const onKey = (e) => {
      const ae = document.activeElement
      const tag = ae?.tagName
      const isTextInput =
        tag === 'TEXTAREA' ||
        (tag === 'INPUT' && /^(text|email|search|url|password|tel|number)$/.test(ae.type || ''))
      if (e.key === 'Escape' && !isTextInput) {
        e.preventDefault()
        bulk.clear()
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A') && !isTextInput) {
        if (filteredIds.length === 0) return
        e.preventDefault()
        bulk.selectAllVisible(filteredIds)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bulk.count, filteredIds, bulk])

  return (
    <PageContainer
      size="lg"
      className={cn(
        "space-y-6 sm:space-y-8 transition-[padding-bottom] duration-200",
        // Push content up when the BulkActionTray is open so the last
        // row isn't hidden behind the fixed-position tray.
        bulk.count > 0 && "pb-28 sm:pb-24",
      )}
    >
      <PageHeader
        eyebrow="Servers"
        title="Servers"
        description={
          servers.length === 0
            ? 'No servers connected yet. Connect your first Open Source Panel server to get started.'
            : `${servers.length} server${servers.length === 1 ? '' : 's'} connected to this organization.`
        }
      >
        {canManage && (
          <Link href="/servers/add/create" data-testid="add-server-link">
            <Button  className="gap-2">
              <Plus className="h-4 w-4" />
              Add Server
            </Button>
          </Link>
        )}
      </PageHeader>

      {!canView ? (
        <NoPermission />
      ) : loading ? (
        <LoadingState label="Loading servers…" />
      ) : servers.length > 0 ? (
        <StatRow tiles={[
          { label: 'Total servers', value: servers.length,              icon: ServerIcon,     tone: 'indigo'  },
          { label: 'Healthy',       value: healthCounts.healthy || 0,   icon: Activity,       tone: 'emerald', loading },
          { label: 'Warning',       value: healthCounts.warning || 0,   icon: AlertTriangle,  tone: 'amber',   loading },
          { label: 'Error',         value: healthCounts.error   || 0,   icon: XCircle,        tone: 'red',     loading },
        ]} />
      ) : null}

      {!canView ? (
        <NoPermission />
      ) : loading ? (
        <LoadingState label="Loading servers…" />
      ) : servers.length === 0 ? (
        <div className="space-y-8 max-w-6xl mx-auto" data-testid="servers-empty-state">
          {/* Section 1 — hero block, centered */}
          <div className="text-center max-w-2xl mx-auto pt-2 pb-1">
            <div className="inline-flex h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 items-center justify-center mb-4">
              <ServerIcon className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Welcome — let’s add your first server
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-snug">
              Pick how you want to connect. You can mix and match later — Central Panel
              manages every server through the same dashboard once it’s linked.
            </p>
          </div>

          {/* Section 2 — source picker cards, full-width 3-up on lg+ */}
          {canManage ? (
            <SourcePickerCards />
          ) : (
            <Card className="p-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                You don’t have permission to add servers. Ask an admin to set up your first connection.
              </p>
            </Card>
          )}

          {/* Secondary action — let curious users preview the populated
              experience without going through the wizard. Same demo-data
              seed used by /dashboard's onboarding. */}
          {canManage && (
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
              <button
                type="button"
                onClick={handleSeedDemo}
                className="inline-flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                data-testid="seed-demo-data"
              >
                <Beaker className="h-3.5 w-3.5" />
                Try it with demo data
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Populate the page with 5 sample servers — you can clear them anytime with the banner above the toolbar.
              </span>
            </div>
          )}

          {/* Section 3 — populated preview, full-width below */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <Eye className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <p className="text-2xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                What your servers list will look like
              </p>
            </div>
            <PopulatedServersPreview />
          </div>
        </div>
      ) : (
        <>
          {isDemoData(servers) && !demoBannerDismissed && (
            <div
              data-testid="demo-mode-banner"
              className="flex items-center gap-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2.5 text-sm"
              role="status"
            >
              <Beaker className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-indigo-900 dark:text-indigo-100 flex-1 min-w-0 truncate">
                <span className="font-semibold">Demo mode</span>
                <span className="text-indigo-700/80 dark:text-indigo-200/80"> · viewing sample data. Clear it to start fresh.</span>
              </p>
              <button
                type="button"
                onClick={handleClearDemoData}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 h-8 text-xs font-semibold text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                data-testid="clear-demo-data"
              >
                Clear demo data
              </button>
              <button
                type="button"
                onClick={dismissDemoBanner}
                aria-label="Dismiss demo mode banner"
                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-indigo-700/70 dark:text-indigo-200/70 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
              >
                ×
              </button>
            </div>
          )}
          {/* Toolbar — search, filter, sort, view toggle */}
          <Card className="p-3 sm:p-4 overflow-visible">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              {/* Search — typeahead suggestions from server names */}
              <div className="relative flex-1 min-w-0">
                <TypeaheadInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search servers…"
                  ariaLabel="Search servers"
                  suggestions={serverNames}
                  className="min-w-0"
                />
              </div>

              {/* Filter chips — status with live counts and a colored dot */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {STATUS_FILTERS.map((f) => {
                  const active = filter === f.id
                  const count = healthCounts[f.countKey] ?? 0
                  const dot = STATUS_DOT[f.id]
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                        active
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/40"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white",
                      )}
                      aria-pressed={active}
                    >
                      {dot && (
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dot)} aria-hidden />
                      )}
                      <span>{f.label}</span>
                      <span className={cn(
                        "text-xs tabular-nums",
                        active ? "opacity-70" : "text-slate-400 dark:text-slate-500"
                      )}>{count}</span>
                    </button>
                  )
                })}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="servers-sort" className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Sort
                </label>
                <select
                  id="servers-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* View toggle — hidden on small screens */}
              <div className="hidden md:flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  aria-label="Grid view"
                  aria-pressed={view === 'grid'}
                  className={cn(
                    "h-8 w-8 rounded-md flex items-center justify-center transition-colors",
                    view === 'grid'
                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white dark:text-slate-400 dark:hover:text-white",
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView('table')}
                  aria-label="Table view"
                  aria-pressed={view === 'table'}
                  className={cn(
                    "h-8 w-8 rounded-md flex items-center justify-center transition-colors",
                    view === 'table'
                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white dark:text-slate-400 dark:hover:text-white",
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              {/* Select-mode toggle removed in favor of per-card Share button. */}
            </div>
          </Card>

          {/* Results count + bulk-select affordance. The "Select all N
              matching" link lets the user add every currently-filtered
              server to the selection in one click. Hidden when the
              filtered set is empty or already fully selected. */}
          <div className="flex items-center justify-between gap-3 -mt-3 flex-wrap">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {filteredServers.length === servers.length
                ? `Showing all ${servers.length} server${servers.length === 1 ? '' : 's'}`
                : `Showing ${filteredServers.length} of ${servers.length} server${filteredServers.length === 1 ? '' : 's'}`}
            </p>
            {filteredServers.length > 0 && !bulk.isAllVisibleSelected(filteredIds) && (
              <button
                type="button"
                onClick={() => bulk.selectAllVisible(filteredIds)}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                data-testid="select-all-matching"
              >
                Select all {filteredServers.length} matching
              </button>
            )}
            {filteredServers.length > 0 && bulk.isAllVisibleSelected(filteredIds) && bulk.count > 0 && (
              <span className="inline-flex items-center gap-3 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                <span>All {filteredServers.length} matching selected</span>
                {bulk.count > filteredServers.length && (
                  <button
                    type="button"
                    onClick={() => bulk.clear()}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:hover:text-white hover:underline"
                    data-testid="deselect-all-matching"
                  >
                    Deselect all
                  </button>
                )}
              </span>
            )}
            {filteredServers.length > 0 && !bulk.isAllVisibleSelected(filteredIds) && bulk.count > 0 && (
              <button
                type="button"
                onClick={() => bulk.clear()}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:hover:text-white hover:underline"
                data-testid="deselect-all-matching"
              >
                Deselect all {bulk.count}
              </button>
            )}
          </div>

          {/* Empty filtered result */}
          {filteredServers.length === 0 ? (
            <Card className="p-10 sm:p-12 text-center">
              <SearchIcon className="h-8 w-8 mx-auto text-slate-400 dark:text-slate-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white mt-3">No matches</h3>
              <NoMatchesCopy search={search} filter={filter} />
              <button
                type="button"
                onClick={() => { setSearch(''); setFilter('all') }}
                className="mt-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear filters
              </button>
            </Card>
          ) : view === 'grid' ? (
            <ServerGrid
              servers={filteredServers}
              canManage={canManage}
              isOwner={isOwner}
              isSelected={(s) => bulk.has(s.id)}
              onToggleSelect={(s) => bulk.toggle(s.id)}
              onShare={(s) => setShareTarget({
                mode: 'single',
                serverIds: [s.id],
                serverNames: [s.name],
              })}
            />
          ) : (
            <ServerTable
              servers={filteredServers}
              canManage={canManage}
              isOwner={isOwner}
              isSelected={(s) => bulk.has(s.id)}
              onToggleSelect={(s) => bulk.toggle(s.id)}
              onShare={(s) => setShareTarget({
                mode: 'single',
                serverIds: [s.id],
                serverNames: [s.name],
              })}
            />
          )}
        </>
      )}

      {/* Server-share dialog — renders ONCE for either trigger path
          (per-row Share button or bulk Share in the tray). The
          {mode, serverIds, serverNames} state shape was lifted so we
          don't need two dialog instances. The dialog itself is
          multi-server capable already (see ServerShareDialog.jsx). */}
      {shareTarget && (
        <ServerShareDialog
          open={!!shareTarget}
          onOpenChange={(o) => { if (!o) setShareTarget(null) }}
          mode="add"
          serverIds={shareTarget.serverIds}
          serverNames={shareTarget.serverNames}
          onSuccess={() => {
            if (shareTarget?.mode === 'bulk') bulk.clear()
            setShareTarget(null)
          }}
        />
      )}

      {/* Bulk disconnect confirm — destructive, gated by canManage.
          The dialog lists up to 3 server names explicitly and collapses
          the rest into "and N more" so the title doesn't blow up on
          large selections. Uses the shared ConfirmDialog component
          (variant="destructive" paints the confirm button red). */}
      {bulkDisconnectTarget && (
        <ConfirmDialog
          open={!!bulkDisconnectTarget}
          onOpenChange={(o) => {
            // Block dismiss while the request is in-flight so the
            // user can't double-submit or lose the in-progress toast.
            if (!o && !bulkDisconnecting) setBulkDisconnectTarget(null)
          }}
          title={
            bulkDisconnectTarget.serverIds.length === 1
              ? 'Disconnect server?'
              : `Disconnect ${bulkDisconnectTarget.serverIds.length} servers?`
          }
          description={
            <>
              <span className="font-semibold text-slate-900 dark:text-white">
                {bulkDisconnectTarget.serverNames.slice(0, 3).join(', ')}
                {bulkDisconnectTarget.serverNames.length > 3 &&
                  ` and ${bulkDisconnectTarget.serverNames.length - 3} more`}
              </span>
              {' '}will be removed from Central Panel. The actual servers keep running —
              you can reconnect any of them by pasting their Server Management Key again.
            </>
          }
          confirmText="Disconnect"
          variant="destructive"
          loading={bulkDisconnecting}
          onConfirm={async () => {
            if (!bulkDisconnectTarget) return
            setBulkDisconnecting(true)
            try {
              const result = await api.bulkDisconnectServers(bulkDisconnectTarget.serverIds)
              const count = result?.disconnectedServerIds?.length ?? bulkDisconnectTarget.serverIds.length
              showToast.success(
                count === 1
                  ? `Disconnected ${result.disconnectedServerNames[0] || '1 server'}`
                  : `Disconnected ${count} servers`
              )
              bulk.clear()
              setBulkDisconnectTarget(null)
              await loadServers()
            } catch (err) {
              showToast.error(err?.message || 'Failed to disconnect servers')
            } finally {
              setBulkDisconnecting(false)
            }
          }}
        />
      )}

      {/* Bulk action tray — fixed-position bottom of the page. Renders
          nothing when selection is empty (gate is inside the component).
          Selection-clears-on-success is enforced via the share dialog's
          onSuccess above; future bulk actions should clear too.

          Actions in order:
            1. shareServerAccess — primary. Works today.
            2. deleteServers    — secondary in the overflow menu.
                                 Opens a destructive ConfirmDialog.
            3. restartServers   — disabled placeholder (bulk restart
                                 isn't implemented in this prototype;
                                 the per-row ServerActionsMenu doesn't
                                 expose restart either, so the bulk
                                 button stays grayed out with a clear
                                 tooltip).
            4. tagServers       — disabled placeholder (no tag concept
                                 in the schema). Same pattern.

          Eligibility rules in @/lib/bulk-eligibility handle the canManage
          gate for deleteServers and the disabledReason override for the
          two placeholders, so no per-action guards are needed here. */}
      <BulkActionTray
        rowIds={Array.from(bulk.selection)}
        rows={selectedRows}
        getRowLabel={(s) => s.name}
        getRowSubLabel={(s) => s.region || s.hostname || null}
        hasHiddenSelection={hasHiddenSelection}
        onRemove={(id) => bulk.remove(id)}
        onClear={() => bulk.clear()}
        currentUser={{ isOwner, canManageServers: canManage }}
        selectionEligibility={bulkActionEligibility({
          actionId: 'shareServerAccess',
          selection: selectedRows,
          currentUser: { isOwner, canManageServers: canManage },
        })}
        actions={[
          {
            id: 'shareServerAccess',
            label: 'Share access',
            icon: ShareIcon,
            tooltipWhenEnabled: bulk.count === 1
              ? `Share access to this server with a new or existing user`
              : `Share access to these ${bulk.count} servers with a new or existing user`,
            onClick: (serverIds) => {
              const inOrder = serverIds
                .map((id) => selectedRows.find((r) => r.id === id))
                .filter(Boolean)
              setShareTarget({
                mode: 'bulk',
                serverIds,
                serverNames: inOrder.map((s) => s.name),
              })
            },
          },
          {
            id: 'deleteServers',
            label: bulk.count === 1 ? 'Disconnect' : `Disconnect ${bulk.count}`,
            icon: PlugZap,
            tooltipWhenEnabled: bulk.count === 1
              ? 'Disconnect this server from Central Panel'
              : `Disconnect these ${bulk.count} servers from Central Panel`,
            onClick: (serverIds) => {
              const inOrder = serverIds
                .map((id) => selectedRows.find((r) => r.id === id))
                .filter(Boolean)
              setBulkDisconnectTarget({
                serverIds,
                serverNames: inOrder.map((s) => s.name),
              })
            },
          },
          {
            id: 'restartServers',
            label: 'Restart',
            icon: RefreshCw,
            // No onClick — eligibility rule marks this disabled so the
            // tray renders it grayed out with the disabledReason in the
            // tooltip. Adding an onClick here would be a no-op even if
            // the eligibility layer were bypassed.
          },
          {
            id: 'tagServers',
            label: 'Tag',
            icon: TagIcon,
            // Same as restartServers — placeholder until the prototype
            // supports per-row tagging.
          },
        ]}
      />
    </PageContainer>
  )
}

// ---------------------------------------------------------------------------
// Grid view
// ---------------------------------------------------------------------------

function ServerGrid({ servers, canManage, isOwner, isSelected, onToggleSelect, onShare }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {servers.map((s) => (
        <ServerCard
          key={s.id}
          server={s}
          canManage={canManage}
          isOwner={isOwner}
          selected={!!isSelected?.(s)}
          onToggleSelect={() => onToggleSelect?.(s)}
          onShare={() => onShare?.(s)}
        />
      ))}
    </div>
  )
}

function CopyIpButton({ ip }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(ip)
      setCopied(true)
      showToast.success('IP copied to clipboard')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      showToast.error('Could not copy IP')
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : `Copy IP: ${ip}`}
      aria-label={copied ? 'Copied!' : `Copy IP: ${ip}`}
      className={cn(
        'shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800/60 transition-colors',
        copied && 'text-emerald-600 dark:text-emerald-400'
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

function ServerCard({ server, canManage, isOwner, selected, onToggleSelect, onShare }) {
  const health = classifyHealth(server)
  const meta = HEALTH_META[health]
  const cpu = server?.cpu?.loadPct ?? 0
  const memPct = server?.memory?.totalMb
    ? Math.round(((server.memory.usedMb || 0) / server.memory.totalMb) * 100)
    : 0
  const cpuColor = cpu >= 90 ? 'bg-red-500' : cpu >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
  const memColor = memPct >= 95 ? 'bg-red-500' : memPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'

  // Map server health to a Card accent rail tone. Healthy → emerald,
  // warning → amber, error → red, unknown → slate. Gives each card a
  // colored top accent that matches its status without relying solely
  // on the status dot text.
  const accentTone =
    health === 'healthy' ? 'emerald' :
    health === 'warning' ? 'amber' :
    health === 'error' ? 'red' : 'slate'

  return (
    <Card
      elevated
      interactive
      accent={accentTone}
      className={cn(
        "group p-0 h-full relative overflow-hidden flex flex-col",
        selected && "ring-2 ring-indigo-500 dark:ring-indigo-400 border-indigo-200 dark:border-indigo-500/40",
      )}
    >
      {/* ===== Section 1 — Identity: icon, name, IP, status, kebab ===== */}
      <div className="p-5 pb-4">
        {/* Bulk-select toggle. Top-left absolute so it floats over the
            card edge without shifting layout. Opacity-0 by default,
            opacity-100 on card hover OR while selected — this is the
            canonical "discoverable affordance, calm default state"
            pattern from Gmail / Notion. stopPropagation prevents the
            click from also firing the underlying Link (which would
            navigate into the server detail page).

            Hidden entirely for rows the user can't manage — there's
            no point selecting something you can't take a bulk
            action on, and showing a disabled toggle is just noise. */}
        {canManage && (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={selected
              ? `Remove ${server.name} from selection`
              : `Add ${server.name} to selection`}
            data-testid={`server-select-${server.id}`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleSelect?.()
            }}
            className={cn(
              "absolute top-2.5 left-2.5 z-10",
              "h-7 w-7 rounded-md flex items-center justify-center",
              "transition-all duration-150",
              selected
                ? "opacity-100 bg-indigo-600 text-white shadow"
                : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400",
            )}
          >
            {selected ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
          </button>
        )}

        <div className="flex items-start justify-between gap-3">
          <Link href={`/servers/${server.id}`} className="flex items-start gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-inset ring-indigo-200/60 dark:ring-indigo-500/20 flex items-center justify-center shrink-0">
              <ServerIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1">
              {/* Name + status dot on one line */}
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn("h-2 w-2 rounded-full shrink-0", meta.dot)} aria-hidden />
                <p className="font-semibold text-slate-900 dark:text-white truncate">{server.name}</p>
              </div>
              {/* Ownership badge — only shown when the current user is
                  NOT the owner. Owner rows are the default so the badge
                  would be visual noise there. Helps "what can I do here"
                  disambiguation in mixed-org lists. */}
              {!isOwner && (
                <p className="mt-0.5 text-2xs font-medium text-slate-500 dark:text-slate-400">
                  Owned by {server.connectedByName || server.connectedByEmail || 'another member'}
                </p>
              )}
              {/* IP directly below the name, with a copy button. The hostname
                  is the less critical fact — it lives in the meta row. */}
              {server.ip && (
                <div className="mt-1 flex items-center gap-1 min-w-0">
                  <span
                    className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate"
                    title={server.ip}
                  >
                    {server.ip}
                  </span>
                  <CopyIpButton ip={server.ip} />
                </div>
              )}
            </div>
          </Link>
          {/* Action cluster: Share + 3-dot. Renders for ALL rows in a
              managed list — non-owned rows get a disabled Share button
              with a tooltip explaining why ("only the server owner can
              share access") instead of the icon disappearing entirely.
              Same pattern as the always-rendered menu items below. */}
          {canManage && (
            <div className="shrink-0 flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  if (!isOwner) return
                  e.stopPropagation()
                  e.preventDefault()
                  onShare?.()
                }}
                disabled={!isOwner}
                aria-label={isOwner ? `Share ${server.name}` : `Can't share ${server.name} — only the server owner can grant access`}
                title={isOwner ? 'Share access' : 'Only the server owner can grant access'}
                className={cn(
                  "h-8 w-8 rounded-md flex items-center justify-center transition-colors",
                  isOwner
                    ? "text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                    : "text-slate-300 dark:text-slate-600 cursor-not-allowed",
                )}
              >
                <ShareIcon className="h-4 w-4" aria-hidden />
              </button>
              <ServerActionsMenu server={server} />
            </div>
          )}
        </div>

        {/* Hostname + source + region as small inline meta. Hostname is
            the longest string so it gets the truncate. */}
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 min-w-0">
          <span
            className="inline-flex items-center gap-1 truncate min-w-0"
            title={server.hostname || ''}
          >
            <ServerIcon className="h-3 w-3 shrink-0" />
            <span className="truncate font-mono">{server.hostname || '—'}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 shrink-0" title="How this server was added">
            <SourceIcon source={server.source || (server.keyId ? 'management_key' : null)} />
          </span>
          <span className="inline-flex items-center gap-1 truncate min-w-0">
            <Globe className="h-3 w-3 shrink-0" />
            <span className="truncate">{server.region || '—'}</span>
          </span>
        </div>
      </div>

      {/* ===== Section 2 — Resources: tinted band with CPU + MEM bars ===== */}
      <div className="bg-slate-50/70 dark:bg-slate-800/40 border-y border-slate-200/80 dark:border-slate-800 px-5 py-3 space-y-2">
        <div className="flex items-center justify-between text-xxs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <span>Resources</span>
          <Badge variant="secondary" className="text-2xs font-medium tabular-nums">
            {Math.max(cpu, memPct)}% peak
          </Badge>
        </div>
        <MiniBar icon={Cpu} label="CPU" value={cpu} fillClass={cpuColor} />
        <MiniBar icon={MemoryStick} label="MEM" value={memPct} fillClass={memColor} />
      </div>

      {/* ===== Section 3 — Actions: timestamp + three stacked buttons ===== */}
      <div className="p-4 mt-auto space-y-3">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {server.connectedAt ? `Added ${timeAgo(server.connectedAt)}` : 'Added recently'}
        </div>
        <div className="flex flex-col gap-1.5">
          <Link
            href={`/servers/${server.id}`}
            title="Open this server in Central Panel"
            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800/40 transition-colors text-xs font-medium"
          >
            Dashboard
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </Card>
  )
}

function MiniBar({ icon: Icon, label, value, fillClass }) {
  const safeValue = Math.max(0, Math.min(100, value || 0))
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
      <span className="text-slate-500 dark:text-slate-400 w-7 shrink-0">{label}</span>
      <Progress value={safeValue} className="flex-1 h-1.5" indicatorClassName={fillClass} />
      <span className="tabular-nums text-slate-600 dark:text-slate-300 w-9 text-right shrink-0">
        {safeValue}%
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Populated-state preview (shown in the empty state). Purely visual — no
// interactivity, no real data. Mirrors the layout of the real /servers
// list (rows + status dots + cpu/mem mini-bars + a closing recommendation
// banner) so a first-time admin sees what the page looks like populated.
// ---------------------------------------------------------------------------
function PopulatedServersPreview() {
  const rows = [
    { name: 'cache-01', region: 'fra1', cpu: 95, mem: 92, status: 'error' },
    { name: 'db-01',    region: 'nyc3', cpu: 78, mem: 83, status: 'warning' },
    { name: 'web-01',   region: 'nyc3', cpu: 45, mem: 29, status: 'healthy' },
    { name: 'api-01',   region: 'sfo2', cpu: 12, mem: 20, status: 'healthy' },
  ]

  const dotClass = {
    error:   'bg-red-500',
    warning: 'bg-amber-500',
    healthy: 'bg-emerald-500',
  }

  const barClass = {
    error:   'bg-red-500',
    warning: 'bg-amber-500',
    healthy: 'bg-indigo-500',
  }

  const pillClass = {
    error:   'bg-red-500/15 text-red-600 dark:text-red-400',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  }

  return (
    <Card elevated className="p-0 overflow-hidden flex-1 flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
          <ServerIcon className="h-3.5 w-3.5 text-indigo-500" />
          Your servers
          <span className="ml-1 text-xxs font-medium text-slate-500 dark:text-slate-400">· 4 total</span>
        </p>
        <span className="text-xxs text-slate-500 dark:text-slate-400">Preview</span>
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800 flex-1">
        {rows.map((r) => (
          <li key={r.name} className="px-4 py-2.5 flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass[r.status]}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                {r.name}
                {(r.status === 'error' || r.status === 'warning') && (
                  <span className={`inline-flex items-center px-1 h-3.5 rounded-sm text-[8px] font-bold uppercase tracking-wider ${pillClass[r.status]}`}>
                    {r.status === 'error' ? 'attention' : 'warning'}
                  </span>
                )}
              </p>
              <p className="text-xxs text-slate-500 dark:text-slate-400 truncate">{r.region}</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <span className="text-xxs tabular-nums text-slate-500 dark:text-slate-400 w-6 text-right">
                {r.cpu}%
              </span>
              <div className="w-10 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full ${barClass[r.status]}`} style={{ width: `${r.cpu}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      {/* Mini recommendation banner — shows the “after” state of the predicted banner */}
      <div className="px-3 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-red-500/[0.04] flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-red-500 shrink-0" />
        <p className="text-2xs text-slate-700 dark:text-slate-300 truncate">
          <span className="font-semibold">2 servers need attention</span>
          <span className="text-slate-500 dark:text-slate-400"> · cache-01 at risk</span>
        </p>
        <ArrowRight className="h-3 w-3 text-red-500 ml-auto shrink-0" />
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------

function ServerTable({ servers, canManage, isOwner, isSelected, onToggleSelect, onShare }) {
  return (
    <Card className="p-0 overflow-hidden hidden md:block">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/60 dark:bg-slate-900/60 hover:bg-slate-50/60 dark:hover:bg-slate-900/60">
              <TableHead className="pl-3 pr-1 w-10">
                <span className="sr-only">Select</span>
              </TableHead>
              <TableHead>Server</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-44">CPU</TableHead>
              <TableHead className="w-44">Memory</TableHead>
              <TableHead className="text-right w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servers.map((s) => (
              <ServerTableRow
                key={s.id}
                server={s}
                canManage={canManage}
                isOwner={isOwner}
                selected={!!isSelected?.(s)}
                onToggleSelect={() => onToggleSelect?.(s)}
                onShare={onShare}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

function ServerTableRow({ server, canManage, isOwner, selected, onToggleSelect, onShare }) {
  const health = classifyHealth(server)
  const meta = HEALTH_META[health]
  const cpu = server?.cpu?.loadPct ?? 0
  const memPct = server?.memory?.totalMb
    ? Math.round(((server.memory.usedMb || 0) / server.memory.totalMb) * 100)
    : 0
  const cpuColor = cpu >= 90 ? 'bg-red-500' : cpu >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
  const memColor = memPct >= 95 ? 'bg-red-500' : memPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <TableRow
      className={cn(
        selected && "bg-indigo-50/60 dark:bg-indigo-500/10 hover:bg-indigo-50 dark:hover:bg-indigo-500/15",
      )}
    >
      <TableCell className="pl-3 pr-1 py-3">
        {/* Hidden when the user can't manage — same reasoning as the
            card-view toggle. */}
        {canManage && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.()}
            onClick={(e) => e.stopPropagation()}
            aria-label={selected
              ? `Remove ${server.name} from selection`
              : `Add ${server.name} to selection`}
            data-testid={`server-select-${server.id}`}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 dark:text-indigo-300 focus:ring-indigo-500/30 cursor-pointer"
          />
        )}
      </TableCell>
      <TableCell>
        <Link href={`/servers/${server.id}`} className="flex items-center gap-3 min-w-0">
          <span className={cn("h-2 w-2 rounded-full shrink-0", meta.dot)} aria-hidden />
          <div className="min-w-0">
            <p className="font-medium text-slate-900 dark:text-white truncate">{server.name}</p>
            {!isOwner && (
              <p className="text-2xs font-medium text-slate-500 dark:text-slate-400 truncate">
                Owned by {server.connectedByName || server.connectedByEmail || 'another member'}
              </p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{server.hostname}</p>
            {server.ip && (
              <p className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate">{server.ip}</p>
            )}
          </div>
        </Link>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="text-sm text-slate-700 dark:text-slate-200">{server.region || '—'}</span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge variant={meta.badge} size="sm">
          <span className={cn("h-1.5 w-1.5 rounded-full inline-block mr-1.5", meta.dot)} />
          {meta.label}
        </Badge>
      </TableCell>
      <TableCell>
        <MiniBar icon={Cpu} label="CPU" value={cpu} fillClass={cpuColor} />
      </TableCell>
      <TableCell>
        <MiniBar icon={MemoryStick} label="MEM" value={memPct} fillClass={memColor} />
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center justify-end gap-1">
          <Link
            href={`/servers/${server.id}`}
            title="Dashboard (Central Panel)"
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60 transition-colors"
          >
            <ServerIcon className="h-3.5 w-3.5" />
          </Link>
          {server.panelUrl && (
            <a
              href={`${server.panelUrl}#services`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Services (${server.panelUrl}#services)`}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/60 transition-colors"
            >
              <Activity className="h-3.5 w-3.5" />
            </a>
          )}
          {server.panelUrl && (
            <a
              href={server.panelUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open Source Panel — ${server.panelUrl}`}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:text-indigo-200 dark:hover:bg-indigo-500/10 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {canManage && <ServerActionsMenu server={server} />}
          {/* Always-rendered Share button — disabled state explains why
              non-owners can't share, rather than the icon disappearing. */}
          {canManage && (
            <button
              type="button"
              onClick={() => { if (isOwner) onShare?.(server) }}
              disabled={!isOwner}
              aria-label={isOwner ? `Share ${server.name}` : `Can't share ${server.name} — only the server owner can grant access`}
              title={isOwner ? 'Share access' : 'Only the server owner can grant access'}
              className={cn(
                "inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors",
                isOwner
                  ? "text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                  : "text-slate-300 dark:text-slate-600 cursor-not-allowed",
              )}
            >
              <ShareIcon className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// Shared empty / no-permission states
// ---------------------------------------------------------------------------

function NoMatchesCopy({ search, filter }) {
  const trimmed = (search || '').trim()
  const filterLabel = STATUS_FILTERS.find((f) => f.id === filter)?.label
  const hasSearch = trimmed.length > 0
  const hasFilter = filter && filter !== 'all'

  if (hasSearch && hasFilter) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        No server named &ldquo;<span className="font-medium text-slate-700 dark:text-slate-200">{trimmed}</span>&rdquo; in the {filterLabel} filter.
      </p>
    )
  }
  if (hasSearch) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        No server named &ldquo;<span className="font-medium text-slate-700 dark:text-slate-200">{trimmed}</span>&rdquo;.
      </p>
    )
  }
  if (hasFilter) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        No servers in the {filterLabel} filter.
      </p>
    )
  }
  return (
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
      Try a different search or filter.
    </p>
  )
}

function NoPermission() {
  return (
    <Card className="p-10 sm:p-12 text-center">
      <ServerIcon className="h-10 w-10 mx-auto text-slate-400 dark:text-slate-500" />
      <h3 className="font-semibold text-slate-900 dark:text-white mt-4">No access</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        You don't have permission to view servers in this organization.
      </p>
    </Card>
  )
}