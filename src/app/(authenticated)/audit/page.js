'use client'

/**
 * /audit — every action taken in the active Organization.
 *
 * Polish parity with /members, /organizations, /servers: stat row,
 * search/filter/sort, shadcn Table on desktop + collapsed cards on
 * mobile, group by day, action meta + category, date range presets,
 * relative timestamps, actor initials avatar, skeletons, empty/no-matches
 * states, and a single clear-all ConfirmDialog.
 *
 * Scope deliberately omits bulk delete, pagination/virtualization, and
 * CSV/JSON export — none add value at current entry counts and all
 * would balloon scope. Easy to add later when needed.
 *
 * Day-grouping: scroll-past everywhere (per preference). Day headers
 * are full-width rows BETWEEN entries; they scroll naturally.
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  History, Trash2, Activity, Plug, PlugZap, Info, HardDrive, RefreshCw,
  UsersRound, UserPlus, UserMinus, KeyRound, LogIn, LogOut, UserCog, Building2,
  ShieldCheck, UserCheck, Cloud, ServerCog, Search, ChevronDown, ChevronRight,
  Filter, ArrowUpDown, X, AlertTriangle, Download, User,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TypeaheadInput } from '@/components/ui/typeahead-input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState, LoadingState, PageContainer, PageHeader } from '@/components/ui/page'
import { Skeleton } from '@/components/ui/skeleton'
import { StatRow } from '@/components/primitives/StatRow'
import { useListToolbarState } from '@/hooks/useListToolbarState'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { showToast } from '@/utils/toast-utils'
import { getActorColor, getActorInitials } from '@/utils/avatar-utils'

import { useOrganizationStore } from '@/stores/organizationStore'
import { useAuthStore } from '@/stores/authStore'
import { useCan } from '@/hooks/useCan'
import * as api from '@/services/centralApi'

// ---------------------------------------------------------------------------
// Action metadata + categorization
// ---------------------------------------------------------------------------
//
// Every appendAudit site feeds an `action` string. ACTION_META maps that
// string to (label, icon, variant, category). CATEGORY_META groups
// actions for the toolbar's category filter.
//
// Categories are user-facing groups, NOT action namespaces — they
// reflect how a person reading the log thinks ("things about members"),
// not the codebase's organization.

const CATEGORIES = {
  all:        { label: 'All',           value: 'all'        },
  members:    { label: 'Members & roles', value: 'members'  },
  servers:    { label: 'Servers & providers', value: 'servers' },
  orgs:       { label: 'Organizations', value: 'orgs'       },
  account:    { label: 'Account',       value: 'account'    },
}

const CATEGORY_ORDER = ['all', 'members', 'servers', 'orgs', 'account']

const CATEGORY_TONE = {
  all:     { bg: 'bg-indigo-50 dark:bg-indigo-500/10',  text: 'text-indigo-600 dark:text-indigo-300' },
  members: { bg: 'bg-violet-50 dark:bg-violet-500/10',  text: 'text-violet-600 dark:text-violet-300' },
  servers: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-300' },
  orgs:    { bg: 'bg-sky-50 dark:bg-sky-500/10',        text: 'text-sky-600 dark:text-sky-300' },
  account: { bg: 'bg-slate-100 dark:bg-slate-700/40',   text: 'text-slate-600 dark:text-slate-300' },
}

const ACTION_META = {
  register:                      { label: 'Registered',                icon: UserPlus,    variant: 'info',    category: 'account' },
  login:                         { label: 'Signed in',                 icon: LogIn,       variant: 'success', category: 'account' },
  logout:                        { label: 'Signed out',                icon: LogOut,      variant: 'default', category: 'account' },
  update_profile:                { label: 'Updated profile',           icon: UserCog,     variant: 'info',    category: 'account' },
  connect_server:                { label: 'Connected a server',        icon: Plug,        variant: 'success', category: 'servers' },
  disconnect_server:             { label: 'Disconnected a server',     icon: PlugZap,     variant: 'warning', category: 'servers' },
  create_server_provider:        { label: 'Provisioned a server',      icon: Cloud,       variant: 'success', category: 'servers' },
  create_server_custom_vps:      { label: 'Installed on a custom VPS', icon: ServerCog,   variant: 'success', category: 'servers' },
  connect_provider:              { label: 'Connected a provider',      icon: Cloud,       variant: 'info',    category: 'servers' },
  disconnect_provider:           { label: 'Disconnected a provider',   icon: Cloud,       variant: 'warning', category: 'servers' },
  view_server_info:              { label: 'Fetched server info',       icon: Info,        variant: 'info',    category: 'servers' },
  view_disk_usage:               { label: 'Fetched disk usage',        icon: HardDrive,   variant: 'info',    category: 'servers' },
  restart_nginx:                 { label: 'Restarted Nginx',           icon: RefreshCw,   variant: 'warning', category: 'servers' },
  create_team:                   { label: 'Created team',              icon: UsersRound,  variant: 'success', category: 'members' },
  delete_team:                   { label: 'Deleted team',              icon: UsersRound,  variant: 'warning', category: 'members' },
  add_team_member:               { label: 'Added team member',         icon: UserPlus,    variant: 'info',    category: 'members' },
  remove_team_member:            { label: 'Removed team member',       icon: UserMinus,   variant: 'warning', category: 'members' },
  change_team_role:              { label: 'Changed team role',         icon: UserCog,     variant: 'info',    category: 'members' },
  create_organization:           { label: 'Created organization',      icon: Building2,   variant: 'success', category: 'orgs' },
  rename_organization:           { label: 'Renamed organization',      icon: Building2,   variant: 'info',    category: 'orgs' },
  delete_organization:           { label: 'Deleted organization',      icon: Building2,   variant: 'warning', category: 'orgs' },
  create_role:                   { label: 'Created role',              icon: ShieldCheck, variant: 'success', category: 'members' },
  update_role:                   { label: 'Updated role',              icon: ShieldCheck, variant: 'info',    category: 'members' },
  delete_role:                   { label: 'Deleted role',              icon: ShieldCheck, variant: 'warning', category: 'members' },
  add_member:                    { label: 'Added member',              icon: UserPlus,    variant: 'info',    category: 'members' },
  invite_member:                 { label: 'Invited member',            icon: UserPlus,    variant: 'info',    category: 'members' },
  invite_accepted:               { label: 'Invite accepted',           icon: UserCheck,   variant: 'success', category: 'members' },
  resend_invitation:             { label: 'Resent invitation',         icon: UserPlus,    variant: 'info',    category: 'members' },
  change_member_role:            { label: 'Changed member role',       icon: UserCheck,   variant: 'info',    category: 'members' },
  remove_member:                 { label: 'Removed member',            icon: UserMinus,   variant: 'warning', category: 'members' },
  cancel_invitation:             { label: 'Cancelled invitation',      icon: UserMinus,   variant: 'warning', category: 'members' },
  change_password:               { label: 'Changed password',          icon: KeyRound,    variant: 'info',    category: 'account' },
}

// Build a lookup of action → category so toolbar count is O(1).
const ACTION_CATEGORY = (() => {
  const out = {}
  for (const a of Object.keys(ACTION_META)) out[a] = ACTION_META[a].category
  return out
})()

// Default fallback for audit rows with action strings we haven't mapped.
const UNKNOWN_META = { label: 'Activity', icon: Activity, variant: 'default', category: 'servers' }

// ---------------------------------------------------------------------------
// Date range presets
// ---------------------------------------------------------------------------

const DATE_RANGES = [
  { value: 'all',    label: 'All time'    },
  { value: 'today',  label: 'Today'       },
  { value: 'yest',   label: 'Yesterday'   },
  { value: '7d',     label: 'Last 7 days' },
  { value: '30d',    label: 'Last 30 days'},
  { value: 'month',  label: 'This month'  },
]

function inDateRange(atIso, range, now = new Date()) {
  if (range === 'all' || !range) return true
  const t = new Date(atIso)
  if (Number.isNaN(t.getTime())) return false
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const todayStart = startOfDay(now)
  const tStart = startOfDay(t)
  if (range === 'today') return tStart === todayStart
  if (range === 'yest') return tStart === todayStart - 86400000
  if (range === '7d') return t.getTime() >= todayStart - 6 * 86400000
  if (range === '30d') return t.getTime() >= todayStart - 29 * 86400000
  if (range === 'month') return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth()
  return true
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditPage() {
  const me = useAuthStore((s) => s.user)
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  const canView = useCan('organization.activity_log.view')
  const canManage = useCan('organization.settings.manage')

  // -- Data --
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  // -- Toolbar --
  const [category, setCategory] = useState('all')
  const [selectedActions, setSelectedActions] = useState([])
  const [dateRange, setDateRange] = useState('all')
  const [sort, setSort] = useState('newest')
  const [byYou, setByYou] = useState(false)
  const tb = useListToolbarState()

  // -- Modals / detail expansion --
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)
  const [expandedMobileId, setExpandedMobileId] = useState(null)

  // -- Load on mount + active-org change --
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const e = await api.listAudit()
        if (!cancelled) setEntries(e)
      } catch (err) {
        if (!cancelled) showToast.error(err?.message || 'Failed to load audit')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeOrgId])

  // -- When category changes, drop actions that no longer belong --
  useEffect(() => {
    setSelectedActions((prev) => prev.filter((a) => {
      const cat = ACTION_CATEGORY[a] || 'servers'
      return category === 'all' || cat === category
    }))
  }, [category])

  // -- Per-category counts (live) --
  const categoryCounts = useMemo(() => {
    const out = { all: entries.length, members: 0, servers: 0, orgs: 0, account: 0 }
    for (const e of entries) {
      const meta = ACTION_META[e.action] || UNKNOWN_META
      const cat = meta.category
      if (out[cat] !== undefined) out[cat] += 1
    }
    return out
  }, [entries])

  // -- Top-level stats --
  const stats = useMemo(() => {
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startWeek = startToday - 6 * 86400000
    const myEmail = (me?.email || '').toLowerCase()
    let today = 0
    let week = 0
    let mine = 0
    for (const e of entries) {
      const t = new Date(e.at).getTime()
      if (Number.isNaN(t)) continue
      if (t >= startToday) today += 1
      if (t >= startWeek) week += 1
      if (myEmail && (e.actorEmail || '').toLowerCase() === myEmail) mine += 1
    }
    return { total: entries.length, today, week, mine }
  }, [entries, me])

  // -- Filter + sort --
  const filtered = useMemo(() => {
    const q = tb.search.trim().toLowerCase()
    const myEmail = (me?.email || '').toLowerCase()
    let list = entries.filter((e) => {
      if (category !== 'all') {
        const cat = (ACTION_META[e.action] || UNKNOWN_META).category
        if (cat !== category) return false
      }
      if (selectedActions.length > 0 && !selectedActions.includes(e.action)) return false
      if (!inDateRange(e.at, dateRange)) return false
      if (byYou && myEmail && (e.actorEmail || '').toLowerCase() !== myEmail) return false
      if (q) {
        const hay = ((e.actorEmail || '') + ' ' + (e.details || '') + ' ' + (e.target || '')).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    list = [...list].sort((a, b) => {
      const ta = new Date(a.at).getTime()
      const tb = new Date(b.at).getTime()
      if (sort === 'oldest') return ta - tb
      return tb - ta
    })
    return list
  }, [entries, tb.search, category, selectedActions, dateRange, sort, byYou, me?.email])

  // -- Typeahead suggestions: dedup actor emails, targets, and action labels --
  const auditSuggestions = useMemo(() => {
    if (!entries?.length) return []
    const seen = new Set()
    const out = []
    const push = (val) => {
      if (!val) return
      const trimmed = String(val).trim()
      if (!trimmed || seen.has(trimmed.toLowerCase())) return
      seen.add(trimmed.toLowerCase())
      out.push(trimmed)
    }
    for (const e of entries) {
      push(e.actorEmail)
      push(e.target)
      const label = ACTION_META[e.action]?.label
      push(label)
    }
    return out
  }, [entries])

  // -- Group by day (with sticky-past labels) --
  const grouped = useMemo(() => {
    const groups = []
    const idxByKey = new Map()
    for (const e of filtered) {
      const key = dayKey(new Date(e.at))
      let g = idxByKey.get(key)
      if (g === undefined) {
        g = groups.length
        idxByKey.set(key, g)
        groups.push({ key, label: dayLabel(key, new Date()), entries: [] })
      }
      groups[g].entries.push(e)
    }
    return groups
  }, [filtered])

  // -- Active actions in current category (for action filter dropdown) --
  const availableActions = useMemo(() => {
    if (category === 'all') {
      return Object.keys(ACTION_META).sort()
    }
    return Object.keys(ACTION_META).filter((a) => ACTION_CATEGORY[a] === category).sort()
  }, [category])

  // -- Filters active detection --
  const filtersActive = tb.search.trim().length > 0
    || category !== 'all'
    || selectedActions.length > 0
    || dateRange !== 'all'
    || sort !== 'newest'
    || byYou
  const clearFilters = () => {
    tb.clear()
    setCategory('all')
    setSelectedActions([])
    setDateRange('all')
    setSort('newest')
    setByYou(false)
  }

  // -- Export (CSV / JSON) of the currently-filtered view --
  const onExport = (format) => {
    if (filtered.length === 0) {
      showToast.error('Nothing to export with the current filters')
      return
    }
    const rows = buildExportRows(filtered)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    if (format === 'csv') {
      downloadFile('\uFEFF' + toCSV(rows), `audit-log-${stamp}.csv`, 'text/csv;charset=utf-8')
    } else {
      downloadFile(JSON.stringify(rows, null, 2), `audit-log-${stamp}.json`, 'application/json')
    }
    showToast.success(`Exported ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} as ${format.toUpperCase()}`)
  }

  // -- Mutations --
  const onClear = async () => {
    if (clearBusy) return
    setClearBusy(true)
    try {
      await api.clearAudit()
      showToast.success('Audit log cleared')
      setConfirmClear(false)
      setEntries([])
    } catch (err) {
      showToast.error(err?.message || 'Failed to clear')
    } finally {
      setClearBusy(false)
    }
  }

  // -- Render --
  return (
    <PageContainer size="md">
      <PageHeader
        eyebrow="System"
        title="Audit log"
        description="Every action taken in your active organization, newest first."
      >
        {entries.length > 0 && (
          <div className="flex items-center gap-2">
            <ExportMenu
              disabled={filtered.length === 0}
              onExport={onExport}
              count={filtered.length}
            />
            {canManage && (
              <Button variant="outline" className="gap-2" onClick={() => setConfirmClear(true)}>
                <Trash2 className="h-4 w-4" />
                Clear log
              </Button>
            )}
          </div>
        )}
      </PageHeader>

      {!canView ? (
        <NoAccessCard />
      ) : loading && entries.length === 0 ? (
        <LoadingState label="Loading audit log…" />
      ) : entries.length === 0 ? (
        <EmptyLog />
      ) : (
        <>
          <StatRow tiles={[
            { label: 'Total entries', value: stats.total, icon: History,   tone: 'indigo'  },
            { label: 'Today',         value: stats.today, icon: Activity,  tone: 'emerald' },
            { label: 'Last 7 days',   value: stats.week,  icon: RefreshCw, tone: 'amber'   },
            { label: 'By you',        value: stats.mine,  icon: UserCog,   tone: 'slate'   },
          ]} />

          <AuditToolbar
            searchInput={tb.searchInput}
            onSearchInputChange={tb.setSearchInput}
            category={category}
            onCategoryChange={setCategory}
            categoryCounts={categoryCounts}
            selectedActions={selectedActions}
            onToggleAction={(a) =>
              setSelectedActions((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a])
            }
            onClearActions={() => setSelectedActions([])}
            availableActions={availableActions}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            sort={sort}
            onSortChange={setSort}
            byYou={byYou}
            onByYouChange={setByYou}
            byYouAvailable={!!me?.email}
            filtersActive={filtersActive}
            onClearFilters={clearFilters}
            resultsCount={filtered.length}
            totalCount={entries.length}
            suggestions={auditSuggestions}
          />

          {filtered.length === 0 ? (
            <NoMatchesState onClear={clearFilters} />
          ) : loading ? (
            <AuditSkeleton />
          ) : (
            <>
              <div className="hidden md:block mt-4">
                <AuditTable groups={grouped} />
              </div>
              <div className="md:hidden mt-4">
                <AuditCardList
                  groups={grouped}
                  expandedId={expandedMobileId}
                  onToggleExpand={setExpandedMobileId}
                />
              </div>
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={(o) => !o && !clearBusy && setConfirmClear(false)}
        title="Clear the audit log?"
        description="All audit entries will be permanently removed from this organization. This action cannot be undone."
        confirmText="Clear log"
        variant="destructive"
        icon={<Trash2 className="h-5 w-5" />}
        loading={clearBusy}
        onConfirm={onClear}
      />
    </PageContainer>
  )
}

// ---------------------------------------------------------------------------
// No-access + empty-log + no-matches + skeletons
// ---------------------------------------------------------------------------

function NoAccessCard() {
  return (
    <Card className="p-10 sm:p-12 text-center border-slate-200 dark:border-slate-700">
      <History className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600" />
      <h3 className="font-semibold text-slate-900 dark:text-white mt-4">No access</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
        You don't have permission to view the audit log in this organization.
        Ask an organization owner to grant you access.
      </p>
    </Card>
  )
}

function EmptyLog() {
  return (
    <Card className="p-10 sm:p-12 text-center border-slate-200 dark:border-slate-700">
      <History className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600" />
      <h3 className="font-semibold text-slate-900 dark:text-white mt-4">No audit entries yet</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
        The audit log tracks every action taken in this organization: connecting
        servers, inviting members, changing roles, and more. Connect a server or
        invite a teammate to start populating the log.
      </p>
    </Card>
  )
}

function NoMatchesState({ onClear }) {
  return (
    <Card className="mt-4 p-10 text-center border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
      <Search className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
      <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">
        No audit entries match your filters
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        Try a wider date range or remove the action filter.
      </p>
      <Button variant="outline" size="sm" onClick={onClear} className="mt-4">
        <X className="h-4 w-4 mr-1" />
        Clear filters
      </Button>
    </Card>
  )
}

function AuditSkeleton() {
  return (
    <Card className="mt-4 p-0 overflow-hidden border-slate-200 dark:border-slate-700">
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32"><Skeleton className="h-3 w-16" /></TableHead>
              <TableHead className="w-44"><Skeleton className="h-3 w-20" /></TableHead>
              <TableHead><Skeleton className="h-3 w-28" /></TableHead>
              <TableHead><Skeleton className="h-3 w-32" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><div className="flex items-center gap-2"><Skeleton className="h-7 w-7 rounded-full" /><Skeleton className="h-4 w-32" /></div></TableCell>
                <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-full max-w-md" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="md:hidden space-y-3 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-3 space-y-2 border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3"><Skeleton className="h-7 w-7 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-20" /></div></div>
            <Skeleton className="h-3 w-full" />
          </Card>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Stat row
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function AuditToolbar({
  searchInput,
  onSearchInputChange,
  category,
  onCategoryChange,
  categoryCounts,
  selectedActions,
  onToggleAction,
  onClearActions,
  availableActions,
  dateRange,
  onDateRangeChange,
  sort,
  onSortChange,
  byYou,
  onByYouChange,
  byYouAvailable,
  filtersActive,
  onClearFilters,
  resultsCount,
  totalCount,
  suggestions,
}) {
  return (
    <Card className="p-3 sm:p-4 mt-4 border-slate-200 dark:border-slate-700">
      <div className="space-y-3">
        {/* Category chips */}
        <div className="flex flex-wrap items-center gap-2 -mx-1 px-1 pb-1">
          {CATEGORY_ORDER.map((c) => {
            const meta = CATEGORIES[c]
            const tone = CATEGORY_TONE[c]
            const active = c === category
            const count = categoryCounts[c] || 0
            return (
              <button
                key={c}
                type="button"
                onClick={() => onCategoryChange(c)}
                className={cn(
                  'inline-flex items-center gap-2 h-9 px-3 rounded-full text-sm font-medium transition-colors whitespace-nowrap shrink-0 border',
                  active
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                )}
                aria-pressed={active}
              >
                <span className={cn(
                  'inline-flex items-center justify-center w-5 h-5 rounded-md text-xxs font-bold tabular-nums',
                  active
                    ? 'bg-white/20 dark:bg-slate-900/20'
                    : tone.bg + ' ' + tone.text
                )}>
                  {count}
                </span>
                {meta.label}
              </button>
            )
          })}
        </div>

        {/* Search + action + date + sort + clear */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <TypeaheadInput
            value={searchInput}
            onChange={onSearchInputChange}
            placeholder="Search actor, target, or details…"
            ariaLabel="Search audit log"
            suggestions={suggestions}
          />

          <ActionPicker
            selected={selectedActions}
            onToggle={onToggleAction}
            onClear={onClearActions}
            available={availableActions}
            disabled={availableActions.length === 0}
          />

          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => onDateRangeChange(e.target.value)}
              className="h-10 pl-3 pr-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 appearance-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
              aria-label="Date range"
            >
              {DATE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value)}
              className="h-10 pl-3 pr-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 appearance-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
              aria-label="Sort"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <ArrowUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>

          {/* By-you quick filter. Promoted from a stat tile into a toolbar
              toggle so users can scope to their own actions in one click.
              Hidden when no user is signed in. Matches the actor-filter
              pattern from GitHub, Vercel CLI, and Stripe events API. */}
          {byYouAvailable && (
            <button
              type="button"
              onClick={() => onByYouChange(!byYou)}
              aria-pressed={byYou}
              title={byYou ? 'Showing only your actions — click to clear' : 'Show only your actions'}
              className={cn(
                'h-10 px-3 rounded-md border text-sm inline-flex items-center gap-1.5 transition-colors',
                'bg-white dark:bg-slate-900',
                byYou
                  ? 'border-indigo-300 dark:border-indigo-500/60 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <User className="h-4 w-4" />
              By you
            </button>
          )}

          {filtersActive && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}

          <p className="ml-auto text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
            {resultsCount} of {totalCount}
          </p>
        </div>

        {/* Active filter chips */}
        {(selectedActions.length > 0 || (category !== 'all')) && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {category !== 'all' && (
              <Pill label="Category:" value={CATEGORIES[category].label} onClear={() => onCategoryChange('all')} />
            )}
            {selectedActions.map((a) => (
              <Pill
                key={a}
                label="Action:"
                value={ACTION_META[a]?.label || a}
                onClear={() => onToggleAction(a)}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function Pill({ label, value, onClear }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-500/30 text-xs whitespace-nowrap">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium">{value}</span>
      <button
        type="button"
        onClick={onClear}
        className="ml-0.5 -mr-1 inline-flex items-center justify-center w-4 h-4 rounded hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors"
        aria-label={`Remove filter ${value}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Export menu — CSV / JSON of the currently-filtered view
// ---------------------------------------------------------------------------
//
// Mirrors the ActionPicker pattern: button triggers a Popover with two
// menu rows. Each row calls onExport('csv' | 'json'), which streams the
// current filtered list to a downloaded file. Disabled when the filtered
// view is empty (nothing to export).

function ExportMenu({ onExport, disabled, count }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={disabled}>
          <Download className="h-4 w-4" />
          Export{count > 0 ? ` (${count})` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <div className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Export current view
          </p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {count} {count === 1 ? 'entry' : 'entries'} after filters
          </p>
        </div>
        <button
          type="button"
          onClick={() => onExport('csv')}
          disabled={count === 0}
          className="w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-slate-700 dark:text-slate-200">Download as CSV</p>
            <p className="text-2xs text-slate-500 dark:text-slate-400">Excel, Sheets, awk-friendly</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onExport('json')}
          disabled={count === 0}
          className="w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-slate-700 dark:text-slate-200">Download as JSON</p>
            <p className="text-2xs text-slate-500 dark:text-slate-400">One object per entry</p>
          </div>
        </button>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Action picker (multi-select popover)
// ---------------------------------------------------------------------------

function ActionPicker({ selected, onToggle, onClear, available, disabled }) {
  const label = selected.length === 0
    ? 'All actions'
    : selected.length === 1
      ? ACTION_META[selected[0]]?.label || selected[0]
      : `${selected.length} actions`
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'h-10 pl-3 pr-8 rounded-md border text-sm inline-flex items-center gap-2 transition-colors min-w-[140px] justify-between',
            'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200',
            selected.length > 0
              ? 'border-indigo-300 dark:border-indigo-500/60'
              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          aria-label="Filter by action"
        >
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1 max-h-72 overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-200 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Action types</p>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-2xs text-indigo-600 dark:text-indigo-300 hover:underline font-medium"
            >
              Clear
            </button>
          )}
        </div>
        {available.length === 0 ? (
          <p className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">No actions in this category.</p>
        ) : (
          available.map((a) => {
            const meta = ACTION_META[a] || UNKNOWN_META
            const checked = selected.includes(a)
            return (
              <label
                key={a}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(a)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/40"
                />
                <span className={cn('inline-flex items-center justify-center h-6 w-6 rounded-md', badgeBg(meta.variant))}>
                  <meta.icon className={cn('h-3.5 w-3.5', badgeText(meta.variant))} />
                </span>
                <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{meta.label}</span>
              </label>
            )
          })
        )}
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Desktop table — grouped by day
// ---------------------------------------------------------------------------

function AuditTable({ groups }) {
  return (
    <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-700">
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Audit entries
        </p>
        <p className="text-2xs text-slate-500 dark:text-slate-400">
          {groups.length} {groups.length === 1 ? 'day' : 'days'}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/30 dark:bg-slate-800/20">
            <TableHead className="font-medium w-44">Time</TableHead>
            <TableHead className="font-medium w-56">Actor</TableHead>
            <TableHead className="font-medium">Action</TableHead>
            <TableHead className="font-medium">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <React.Fragment key={group.key}>
              <DayRow label={group.label} count={group.entries.length} />
              {group.entries.map((e) => (
                <AuditTableRow key={e.id} entry={e} />
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function DayRow({ label, count }) {
  return (
    <TableRow className="bg-slate-100/60 dark:bg-slate-800/40 border-y border-slate-200 dark:border-slate-700 hover:bg-slate-100/60 dark:hover:bg-slate-800/40">
      <TableCell colSpan={4} className="py-2 px-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">{label}</p>
          <p className="text-2xs text-slate-500 dark:text-slate-400 tabular-nums">{count} {count === 1 ? 'entry' : 'entries'}</p>
        </div>
      </TableCell>
    </TableRow>
  )
}

function AuditTableRow({ entry }) {
  const meta = ACTION_META[entry.action] || UNKNOWN_META
  const Icon = meta.icon
  const initials = getActorInitials(undefined, entry.actorEmail)
  const color = getActorColor(entry.actorEmail)
  const fullAt = new Date(entry.at)
  const titleText = `${fullAt.toLocaleString()}`
  return (
    <TableRow className="group hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
      <TableCell className="align-top">
        <div className="flex flex-col py-1">
          <time
            dateTime={entry.at}
            title={titleText}
            className="text-sm text-slate-900 dark:text-white tabular-nums"
          >
            {formatRelative(fullAt)}
          </time>
          <p className="text-2xs text-slate-500 dark:text-slate-400 tabular-nums hidden sm:block">
            {fullAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2.5 min-w-0 py-1">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className={cn('text-2xs font-semibold', color)} aria-hidden>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-mono text-slate-700 dark:text-slate-200 truncate">{entry.actorEmail || 'system'}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className={cn('inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border whitespace-nowrap', badgeBorder(meta.variant))}>
          <Icon className={cn('h-3.5 w-3.5 shrink-0', badgeText(meta.variant))} />
          <span className={badgeText(meta.variant)}>{meta.label}</span>
        </span>
      </TableCell>
      <TableCell>
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug">{entry.details || '—'}</p>
      </TableCell>
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// Mobile card list — collapsible details per entry
// ---------------------------------------------------------------------------

function AuditCardList({ groups, expandedId, onToggleExpand }) {
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <React.Fragment key={group.key}>
          <DayHeader label={group.label} count={group.entries.length} />
          {group.entries.map((e) => (
            <AuditCard
              key={e.id}
              entry={e}
              expanded={expandedId === e.id}
              onToggle={() => onToggleExpand(expandedId === e.id ? null : e.id)}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  )
}

function DayHeader({ label, count }) {
  return (
    <div className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 mt-2 first:mt-0">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">{label}</p>
        <p className="text-2xs text-slate-500 dark:text-slate-400 tabular-nums">{count}</p>
      </div>
    </div>
  )
}

function AuditCard({ entry, expanded, onToggle }) {
  const meta = ACTION_META[entry.action] || UNKNOWN_META
  const Icon = meta.icon
  const initials = getActorInitials(undefined, entry.actorEmail)
  const color = getActorColor(entry.actorEmail)
  const fullAt = new Date(entry.at)
  const detailsId = `audit-details-${entry.id}`
  const time = formatRelative(fullAt)
  const fullTime = fullAt.toLocaleString()
  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-3 text-left flex items-center gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors rounded-lg"
        aria-expanded={expanded}
        aria-controls={detailsId}
      >
        <span
          className={cn(
            'h-9 w-9 rounded-md flex items-center justify-center shrink-0',
            badgeBg(meta.variant)
          )}
        >
          <Icon className={cn('h-4 w-4', badgeText(meta.variant))} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{meta.label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            <span className="font-mono">{entry.actorEmail || 'system'}</span>
            <span className="mx-1.5">·</span>
            <time dateTime={entry.at} title={fullTime}>{time}</time>
          </p>
        </div>
        <ChevronRight
          className={cn(
            'h-4 w-4 text-slate-400 shrink-0 transition-transform',
            expanded && 'rotate-90'
          )}
        />
      </button>
      {expanded && (
        <div id={detailsId} className="px-4 pb-4 -mt-1 border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className={cn('text-2xs font-semibold', color)}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm font-mono text-slate-700 dark:text-slate-200 truncate">{entry.actorEmail || 'system'}</p>
          </div>
          <div>
            <p className="text-xxs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">When</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 tabular-nums">{fullTime}</p>
          </div>
          {entry.details && (
            <div>
              <p className="text-xxs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Details</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-snug">{entry.details}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function badgeBg(v) {
  return v === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10'
    : v === 'warning' ? 'bg-amber-50 dark:bg-amber-500/10'
    : v === 'info' ? 'bg-blue-50 dark:bg-blue-500/10'
    : v === 'danger' ? 'bg-red-50 dark:bg-red-500/10'
    : 'bg-slate-100 dark:bg-slate-800'
}

function badgeText(v) {
  return v === 'success' ? 'text-emerald-600 dark:text-emerald-400'
    : v === 'warning' ? 'text-amber-600 dark:text-amber-400'
    : v === 'info' ? 'text-blue-600 dark:text-blue-400'
    : v === 'danger' ? 'text-red-600 dark:text-red-400'
    : 'text-slate-500 dark:text-slate-400'
}

function badgeBorder(v) {
  return v === 'success' ? 'border-emerald-200/70 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/10'
    : v === 'warning' ? 'border-amber-200/70 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/10'
    : v === 'info' ? 'border-blue-200/70 dark:border-blue-500/30 bg-blue-50/40 dark:bg-blue-500/10'
    : v === 'danger' ? 'border-red-200/70 dark:border-red-500/30 bg-red-50/40 dark:bg-red-500/10'
    : 'border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40'
}

// Day grouping (UTC day). Stable across DST / TZ changes for grouping; full
// timestamp in the row preserves the real moment.
function dayKey(d) {
  if (Number.isNaN(d.getTime())) return 'invalid'
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(key, now) {
  if (key === 'invalid') return 'Older'
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m, d)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayStart = new Date(y, m, d)
  const diffDays = Math.round((todayStart - dayStart) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return dt.toLocaleDateString([], { weekday: 'long' })
  return dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined })
}

function formatRelative(d) {
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const sec = Math.round(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Export helpers (CSV / JSON of the currently-filtered view)
// ---------------------------------------------------------------------------
//
// Follows the convention used by GitHub and AWS CloudTrail:
//   - CSV column order: timestamp (ISO 8601 UTC), actor, action, action_label,
//     target, details, category. Headers are stable so analysts can pipe the
//     file into grep / awk / spreadsheets without preprocessing.
//   - JSON is the same shape, pretty-printed, one object per line.
//   - A UTF-8 BOM is prepended to CSV so Excel on Windows opens it correctly
//     when `details` contains non-ASCII characters (emails, server names).
//   - Only the currently-filtered view is exported, never the full log —
//     matches the "scope before exporting" pattern every product in the
//     research sweep uses (GitHub, Vercel, AWS CloudTrail).
//
// downloadFile creates an in-memory blob, triggers a hidden anchor click,
// then revokes the object URL. No third-party dep needed.
function buildExportRows(entries) {
  return entries.map((e) => ({
    timestamp: new Date(e.at).toISOString(),
    actor: e.actorEmail || 'system',
    action: e.action,
    action_label: ACTION_META[e.action]?.label || 'Activity',
    category: (ACTION_META[e.action] || UNKNOWN_META).category,
    target: e.target || '',
    details: e.details || '',
  }))
}

function toCSV(rows) {
  if (rows.length === 0) return ''
  const headers = ['timestamp', 'actor', 'action', 'action_label', 'category', 'target', 'details']
  const escape = (v) => {
    const s = String(v ?? '')
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = headers.join(',')
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(',')).join('\n')
  return head + '\n' + body + '\n'
}

function downloadFile(content, filename, mime) {
  if (typeof window === 'undefined') return
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on next tick so the download has time to start in all browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
