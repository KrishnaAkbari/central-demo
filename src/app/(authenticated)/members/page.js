'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Users as UsersIcon, Trash2, Mail, Shield, UserPlus, Crown,
  Clock, MailPlus, Search as SearchIcon, ChevronDown,
  ChevronUp, Send, Check, X as XIcon, AlertTriangle,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingState, PageContainer, PageHeader, EmptyState } from '@/components/ui/page'
import { BulkActionTray } from '@/components/ui/bulk-action-tray'
import { StatRow } from '@/components/primitives/StatRow'
import { TypeaheadInput } from '@/components/ui/typeahead-input'
import { bulkActionEligibility } from '@/lib/bulk-eligibility'

import { useAuthStore } from '@/stores/authStore'
import { useOrganizationStore, useIsOwner } from '@/stores/organizationStore'
import { useCan } from '@/hooks/useCan'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { useListToolbarState } from '@/hooks/useListToolbarState'
import * as api from '@/services/centralApi'
import { showToast } from '@/utils/toast-utils'
import { cn } from '@/utils'

import { AddMemberDialog } from './AddMemberDialog'
import { RoleSelectDropdown } from './RoleSelectDropdown'

// ---------------------------------------------------------------------------
// Sort options for the toolbar sort dropdown. Each entry maps to a stable
// sort key the list below understands. Default is name asc — matches
// /servers' default for the same reason (alphabetical is the path of
// least surprise for a people list).
// ---------------------------------------------------------------------------
const SORT_OPTIONS = [
  { id: 'name',   label: 'Name (A→Z)' },
  { id: 'role',   label: 'Role' },
  { id: 'recent', label: 'Recently added' },
]

// ---------------------------------------------------------------------------
// Role tier ordering used by the role sort and the role filter default
// order. Lower number = higher authority. Owners first, then admins,
// then members, then viewers, then any custom roles alpha by title.
// Mirrors the AddMemberDialog preset order so the page never contradicts
// the dialog.
// ---------------------------------------------------------------------------
const ROLE_TIER = {
  owner: 0,
  admin: 1,
  member: 2,
  viewer: 3,
}

function roleTier(row) {
  if (row?.isOwner) return ROLE_TIER.owner
  const name = (row?.role?.name || '').toLowerCase()
  if (name in ROLE_TIER) return ROLE_TIER[name]
  return 99 // custom roles sort last within role sort
}

function roleLabel(row) {
  if (row?.isOwner) return 'Owner'
  return row?.role?.title || row?.role?.name || 'No role'
}

function displayName(row) {
  if (row?.kind === 'active') return row.user?.name || row.user?.email || ''
  return row?.inviteeEmail || ''
}

function displayEmail(row) {
  if (row?.kind === 'active') return row.user?.email || ''
  return row?.inviteeEmail || ''
}

function rowInitials(row) {
  if (row?.kind === 'active') {
    const name = row.user?.name || row.user?.email || '?'
    return name.slice(0, 1).toUpperCase()
  }
  return row?.namePlaceholder || '?'
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

// ---------------------------------------------------------------------------
// Invitation expiry (NEW 2026-07-18, R44)
// ---------------------------------------------------------------------------
//
// Invitations expire 7 days after being sent — matches the convention
// from GitHub (7d), Stripe (10d), Slack (workspace invites expire), and
// Notion. Without this, an admin who forgets about an old invite just
// sees "invited 6d ago" with no signal that the invite stopped being
// valid. The render surfaces a second line under the existing
// `timeAgo(row.invitedAt)` copy on desktop, and inline on mobile.
//
// Tones:
//   > 2 days remaining — slate (neutral; admin doesn't need to act yet)
//   1-2 days remaining — amber (warning; consider resending or following up)
//   < 1 day remaining  — amber (last call before expiry)
//   expired           — red (admin should resend or cancel)
//
// Returns null when there is no `invitedAt` (i.e. active members) so the
// caller can render unconditionally without an extra guard.
const INVITE_EXPIRY_DAYS = 7

function inviteExpiry(row, now = new Date()) {
  if (!row?.invitedAt) return null
  const invitedAt = new Date(row.invitedAt)
  if (Number.isNaN(invitedAt.getTime())) return null
  const expiresAt = new Date(invitedAt.getTime() + INVITE_EXPIRY_DAYS * 86400000)
  const ms = expiresAt.getTime() - now.getTime()
  const daysLeft = Math.floor(ms / 86400000)
  const hoursLeft = Math.floor(ms / 3600000)
  const titleDate = expiresAt.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
  if (ms <= 0) {
    const daysAgo = Math.max(1, Math.ceil(-ms / 86400000))
    return {
      label: `Expired ${daysAgo}d ago`,
      tone: 'text-red-600 dark:text-red-400 font-medium',
      title: `This invitation expired on ${titleDate}.`,
      expired: true,
      expiresAt,
    }
  }
  // Less than a full day remaining — the admin has hours, not days.
  // Uses ms < DAY (strict) so the boundary at exactly 24h falls into
  // "tomorrow" rather than "today", which feels more accurate: a full
  // day left is still tomorrow's problem.
  if (ms < 86400000) {
    return {
      label: 'Expires today',
      tone: 'text-amber-600 dark:text-amber-400 font-medium',
      title: `This invitation expires later today (${titleDate}).`,
      expired: false,
      expiresAt,
    }
  }
  if (daysLeft === 1) {
    return {
      label: 'Expires tomorrow',
      tone: 'text-amber-600 dark:text-amber-400 font-medium',
      title: `This invitation expires tomorrow (${titleDate}).`,
      expired: false,
      expiresAt,
    }
  }
  return {
    label: `Expires in ${daysLeft} days`,
    tone: 'text-slate-500 dark:text-slate-400',
    title: `This invitation expires on ${titleDate}.`,
    expired: false,
    expiresAt,
  }
}

export default function MembersPage() {
  const me = useAuthStore((s) => s.user)
  const activeOrg = useOrganizationStore((s) => s.organizations.find((o) => o.id === s.activeOrgId))
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  const isOwner = useIsOwner()

  const canView = useCan('organization.members.view')
  const canManage = useCan('organization.members.manage')

  const [rows, setRows] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [resending, setResending] = useState(null)
  const [bulkConfirm, setBulkConfirm] = useState(null)
  const [bulkRunning, setBulkRunning] = useState(false)

  // Toolbar state — search debounces through useListToolbarState. The
  // raw `searchInput` mirrors the input; the debounced `search` is what
  // the derived list reads.
  const [roleFilter, setRoleFilter] = useState('all') // 'all' | 'owner' | role.id
  const [sort, setSort] = useState('name')
  const tb = useListToolbarState()

  // Bulk selection. Lives at page level so the table rows, the card
  // rows, and the BulkActionTray all see the same Set.
  const bulk = useBulkSelection()

  const load = async () => {
    if (!canView) {
      setRows([])
      setRoles([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [m, r] = await Promise.all([
        api.listMembers(),
        api.listRolesForOrg(),
      ])
      setRows(m)
      setRoles(r)
    } catch (err) {
      showToast.error(err?.message || 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [activeOrgId, canView])

  // Derived search value used for filtering. Hook debounces + holds
  // the input; we trim+lowercase here so the existing filter logic
  // stays untouched. Original code trimmed + lowercased identically.
  const memberNames = useMemo(
    () => (rows || []).map((u) => (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.name || u.email || ''))).filter(Boolean),
    [rows]
  )
  const search = useMemo(() => tb.search.trim().toLowerCase(), [tb.search])

  // Stats — derived from the same source the list reads so the tile
  // counts always agree with the rendered rows (when no filter is
  // active). Counts are pre-filter totals so the toolbar chips don't
  // lie about what's hidden.
  const stats = useMemo(() => {
    const active = rows.filter((r) => r.kind === 'active')
    const invites = rows.filter((r) => r.kind === 'invited')
    const owners = active.filter((r) => !!r.isOwner)
    return {
      total: rows.length,
      active: active.length,
      invited: invites.length,
      owners: owners.length,
    }
  }, [rows])

  // Filtered + sorted view of the rows. Used for both the desktop
  // table and the mobile card list — single source of truth.
  const filteredRows = useMemo(() => {
    let list = rows
    if (roleFilter === 'owner') {
      list = list.filter((r) => r.kind === 'active' && !!r.isOwner)
    } else if (roleFilter !== 'all') {
      list = list.filter((r) => !r.isOwner && r.roleId === roleFilter)
    }
    if (search) {
      list = list.filter((r) => {
        const name = displayName(r).toLowerCase()
        const email = displayEmail(r).toLowerCase()
        return name.includes(search) || email.includes(search)
      })
    }
    const sorted = [...list]
    if (sort === 'role') {
      sorted.sort((a, b) => {
        const dt = roleTier(a) - roleTier(b)
        if (dt !== 0) return dt
        return displayEmail(a).localeCompare(displayEmail(b))
      })
    } else if (sort === 'recent') {
      sorted.sort((a, b) => {
        const at = new Date(a.joinedAt || a.invitedAt || 0).getTime()
        const bt = new Date(b.joinedAt || b.invitedAt || 0).getTime()
        return bt - at
      })
    } else {
      // name asc
      sorted.sort((a, b) => displayName(a).localeCompare(displayName(b)))
    }
    return sorted
  }, [rows, roleFilter, search, sort])

  // Split filtered rows into active + invited so each section renders
  // its own table on desktop and its own card list on mobile.
  const filteredActive = useMemo(
    () => filteredRows.filter((r) => r.kind === 'active'),
    [filteredRows],
  )
  const filteredInvites = useMemo(
    () => filteredRows.filter((r) => r.kind === 'invited'),
    [filteredRows],
  )

  // Visible ids across both sections — used by select-all-matching and
  // by the BulkActionTray's hasHiddenSelection hint. Active rows keyed
  // by user.id; invite rows keyed by inviteeEmail so the two are
  // disjoint namespaces and never collide in the Set.
  const visibleIds = useMemo(
    () => filteredRows.map((r) => r.kind === 'active' ? r.user.id : r.inviteeEmail),
    [filteredRows],
  )
  const hasHiddenSelection = useMemo(
    () => bulk.hasHiddenSelection(visibleIds),
    [bulk, visibleIds],
  )

  // Lookup from id to row, used by BulkActionTray's chip rendering.
  const rowById = useMemo(() => {
    const m = new Map()
    for (const r of filteredRows) {
      const id = r.kind === 'active' ? r.user.id : r.inviteeEmail
      m.set(id, r)
    }
    return m
  }, [filteredRows])

  const selectedRows = useMemo(() => {
    const out = []
    for (const id of bulk.selection) {
      const r = rowById.get(id)
      if (r) out.push(r)
    }
    return out
  }, [bulk.selection, rowById])

  // Keyboard shortcuts: Esc clears selection, Ctrl/Cmd+A selects every
  // currently-visible row. Mirrors /servers.
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
        if (visibleIds.length === 0) return
        e.preventDefault()
        bulk.selectAllVisible(visibleIds)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bulk.count, visibleIds, bulk])

  // ----- Per-row mutation handlers -----------------------------------------

  const onRemove = async () => {
    if (!removing) return
    try {
      await api.removeOrgMember(null, removing.user.id)
      showToast.success(`Removed ${removing.user.email}`)
      setRemoving(null)
      load()
    } catch (err) {
      showToast.error(err?.message || 'Failed to remove')
      // If backend refused because they're the only owner, the error
      // message already says so — the toast is enough. No special UI.
    }
  }

  const onCancelInvite = async () => {
    if (!cancelling) return
    try {
      await api.cancelOrgInvitation(null, cancelling.inviteeEmail)
      showToast.success(`Cancelled invitation to ${cancelling.inviteeEmail}`)
      setCancelling(null)
      load()
    } catch (err) {
      showToast.error(err?.message || 'Failed to cancel invitation')
    }
  }

  // Per-row "Resend invite" — single click, no confirmation. The audit
  // log records the resend; the row's "invited 5m ago" copy refreshes
  // on the next reload. Low-risk enough to skip a confirm dialog.
  const onResend = async (row) => {
    try {
      await api.resendOrgInvitation(null, row.inviteeEmail)
      showToast.success(`Invitation re-sent to ${row.inviteeEmail}`)
      load()
    } catch (err) {
      showToast.error(err?.message || 'Failed to resend invitation')
    }
  }

  const onChangeRole = async (row, newRoleId) => {
    if (!newRoleId) return
    const currentId = row.roleId
    if (currentId === newRoleId) return
    try {
      if (row.kind === 'active') {
        await api.changeOrgMemberRole(null, { userId: row.user.id }, newRoleId)
        showToast.success(`Updated role for ${row.user.email}`)
      } else {
        await api.changeOrgMemberRole(null, { inviteeEmail: row.inviteeEmail }, newRoleId)
        showToast.success(`Updated role for ${row.inviteeEmail}`)
      }
      load()
    } catch (err) {
      showToast.error(err?.message || 'Failed to change role')
    }
  }

  // ----- Bulk remove / cancel flow -----------------------------------------

  // Confirm bulk removal — opens a dialog with the combined active +
  // invite counts so the user sees one clear action summary. Owners in
  // the selection are silently skipped (eligibility gate excludes them
  // from the enabled state, but the dialog still shows the breakdown
  // for transparency).
  const openBulkRemove = () => {
    if (selectedRows.length === 0) return
    const activeTargets = selectedRows.filter((r) => r.kind === 'active')
    const inviteTargets = selectedRows.filter((r) => r.kind === 'invited')
    const skippedOwners = activeTargets.filter((r) => r.isOwner).length
    setBulkConfirm({
      activeTargets,
      inviteTargets,
      skippedOwners,
    })
  }

  const onBulkRemove = async () => {
    if (!bulkConfirm) return
    setBulkRunning(true)
    let removedCount = 0
    let cancelledCount = 0
    const errors = []
    try {
      // Active members first — removeOrgMember throws if user is the
      // owner or self; we already filtered those in eligibility, but a
      // race-condition remove-by-another-tab would still throw. Collect
      // errors and continue so a single failure doesn't abort the rest.
      for (const r of bulkConfirm.activeTargets) {
        try {
          await api.removeOrgMember(null, r.user.id)
          removedCount++
        } catch (err) {
          errors.push({ kind: 'active', email: r.user.email, message: err?.message })
        }
      }
      for (const r of bulkConfirm.inviteTargets) {
        try {
          await api.cancelOrgInvitation(null, r.inviteeEmail)
          cancelledCount++
        } catch (err) {
          errors.push({ kind: 'invite', email: r.inviteeEmail, message: err?.message })
        }
      }
      // Toast summary — one line per outcome so the user can audit the
      // batch at a glance without opening the result list.
      const parts = []
      if (removedCount) parts.push(`Removed ${removedCount} member${removedCount === 1 ? '' : 's'}`)
      if (cancelledCount) parts.push(`cancelled ${cancelledCount} invitation${cancelledCount === 1 ? '' : 's'}`)
      if (bulkConfirm.skippedOwners) parts.push(`skipped ${bulkConfirm.skippedOwners} owner${bulkConfirm.skippedOwners === 1 ? '' : 's'}`)
      if (errors.length) parts.push(`${errors.length} failed`)
      const summary = parts.join(', ') || 'No changes'
      if (errors.length) {
        showToast.warning(summary, { duration: 6000 })
      } else {
        showToast.success(summary)
      }
      bulk.clear()
      setBulkConfirm(null)
      load()
    } catch (err) {
      showToast.error(err?.message || 'Bulk remove failed')
    } finally {
      setBulkRunning(false)
    }
  }

  // ----- Render guards ------------------------------------------------------

  if (!canView) {
    return (
      <PageContainer size="sm">
        <EmptyState
          icon={Shield}
          title="No access"
          description="You don't have permission to view members in this organization."
        />
      </PageContainer>
    )
  }

  const activeRows = rows.filter((r) => r.kind === 'active')
  const inviteRows = rows.filter((r) => r.kind === 'invited')
  // First-invite nudge — only owner present and no pending invites.
  // Same shape as before; kept verbatim so the existing UX doesn't
  // regress.
  const onlyOwnerPresent =
    activeRows.length === 1 && !!activeRows[0].isOwner && inviteRows.length === 0
  // Tristate for empty-result messaging. filterActive = user filtered
  // down to zero rows; trulyEmpty = no rows at all and no filter.
  const filterActive = !!search || roleFilter !== 'all'
  const trulyEmpty = rows.length === 0

  const clearFilters = () => {
    tb.setSearchInput('')
    setRoleFilter('all')
  }

  const filterIsActive = !!search || roleFilter !== 'all'

  return (
    <PageContainer
      size="md"
      className={cn(
        'space-y-6 sm:space-y-8 transition-[padding-bottom] duration-200',
        // Make room for the fixed BulkActionTray when something is
        // selected, so the last row isn't covered.
        bulk.count > 0 && 'pb-28 sm:pb-24',
      )}
    >
      <PageHeader
        eyebrow="Access"
        title="Members"
        description={
          activeOrg
            ? `People with access to ${activeOrg.name}.`
            : 'People with access to this organization.'
        }
      >
        {canManage && !onlyOwnerPresent && !trulyEmpty && (
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <MailPlus className="h-4 w-4" />
            Add member
          </Button>
        )}
      </PageHeader>

      {!loading && rows.length > 0 && (
        <StatRow tiles={[
          onlyOwnerPresent
            ? { label: 'Active',  value: stats.active, icon: UsersIcon, tone: 'emerald', subline: stats.invited ? `+${stats.invited} pending` : 'Only you so far' }
            : { label: 'Total',   value: stats.total,  icon: UsersIcon, tone: 'indigo', subline: stats.invited ? `${stats.active} active · ${stats.invited} pending` : `${stats.active} active` },
          { label: 'Pending', value: stats.invited, icon: Clock,   tone: 'amber' },
          { label: 'Owners',  value: stats.owners,  icon: Crown,   tone: 'indigo' },
        ].filter(Boolean)} />
      )}

      {!loading && onlyOwnerPresent && canManage && (
        <Card className="p-5 sm:p-6 flex flex-col sm:flex-row items-start gap-4 border-indigo-200 dark:border-indigo-500/40 bg-gradient-to-br from-indigo-50/60 to-white dark:from-indigo-500/10 dark:to-slate-900">
          <div className="h-11 w-11 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <UserPlus className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              First invite
            </p>
            <h3 className="font-semibold text-slate-900 dark:text-white mt-0.5 text-base sm:text-lg">
              Bring your first teammate into {activeOrg?.name || 'your organization'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Right now it's just you. Invite someone by email to share access, split ownership, and stop running every server action solo.
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)} size="default" className="gap-2 shrink-0">
            <MailPlus className="h-4 w-4" />
            Invite a member
          </Button>
        </Card>
      )}

      {loading ? (
        <LoadingState label="Loading members…" />
      ) : trulyEmpty ? (
        // Truly empty: no rows at all. Keep the rich "what members can
        // do" explainer from the previous design — it's the first-run
        // onboarding moment, so the additional copy is worth its space.
        <Card className="p-8 sm:p-10 text-center" data-testid="members-empty-state">
          <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mx-auto">
            <UsersIcon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mt-4">
            Invite your first member
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {canManage
              ? `Members join ${activeOrg?.name || 'your organization'} by email invitation. Pick a role and send the first invite to get started.`
              : `No members have been added to ${activeOrg?.name || 'this organization'} yet. Ask an admin to send an invite.`}
          </p>
          {canManage && (
            <Button onClick={() => setAddOpen(true)} size="lg" className="mt-6 gap-2">
              <UserPlus className="h-4 w-4" />
              Invite your first member
            </Button>
          )}
          {canManage && (
            <div className="mt-7 pt-6 border-t border-slate-200 dark:border-slate-800 max-w-lg mx-auto">
              <p className="text-2xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                What members can do once they join
              </p>
              <ul className="grid sm:grid-cols-3 gap-3 text-left">
                <li className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <span className="h-6 w-6 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <UsersIcon className="h-3.5 w-3.5" />
                  </span>
                  <span>Access the servers your role allows</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <span className="h-6 w-6 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Shield className="h-3.5 w-3.5" />
                  </span>
                  <span>Work under the role you assign them</span>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <span className="h-6 w-6 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Mail className="h-3.5 w-3.5" />
                  </span>
                  <span>Get an invite link by email</span>
                </li>
              </ul>
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* Toolbar — search, role filter, sort */}
          <Card className="p-3 sm:p-4 overflow-visible">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <TypeaheadInput
                  value={tb.searchInput}
                  onChange={tb.setSearchInput}
                  placeholder="Search by name or email…"
                  ariaLabel="Search members"
                  suggestions={memberNames}
                />
                {tb.searchInput && (
                  <button
                    type="button"
                    onClick={() => tb.setSearchInput('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Role filter — single-select dropdown matching the
                  visible role list. 'All' plus an entry per role id.
                  Owners get their own entry ('owner'); everyone else
                  is matched by role id. */}
              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="members-role-filter" className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Role
                </label>
                <div className="relative">
                  <select
                    id="members-role-filter"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="h-9 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 appearance-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
                    data-testid="members-role-filter"
                  >
                    <option value="all">All roles</option>
                    <option value="owner">Owner</option>
                    {roles
                      .filter((r) => r.name !== 'owner')
                      .map((r) => (
                        <option key={r.id} value={r.id}>{r.title || r.name}</option>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                </div>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="members-sort" className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Sort
                </label>
                <div className="relative">
                  <select
                    id="members-sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="h-9 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 appearance-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
                    data-testid="members-sort"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Active-filter row — only renders when at least one
                filter is engaged. Clears all filters in one click. */}
            {filterIsActive && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {search && (
                  <button
                    type="button"
                    onClick={() => { tb.setSearchInput('') }}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Search: {search}
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
                {roleFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setRoleFilter('all')}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Role: {roleFilter === 'owner' ? 'Owner' : roles.find((r) => r.id === roleFilter)?.title || 'Custom'}
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  data-testid="members-clear-filters"
                >
                  Clear all
                </button>
              </div>
            )}
          </Card>

          {/* Result count + bulk-select affordance */}
          <div className="flex items-center justify-between gap-3 -mt-3 flex-wrap">
            <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
              {filterIsActive
                ? `Showing ${filteredRows.length} of ${rows.length}`
                : `${rows.length} ${rows.length === 1 ? 'person' : 'people'} in this organization`}
            </p>
            {filteredRows.length > 0 && !bulk.isAllVisibleSelected(visibleIds) && (
              <button
                type="button"
                onClick={() => bulk.selectAllVisible(visibleIds)}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                data-testid="members-select-all"
              >
                Select all {filteredRows.length} matching
              </button>
            )}
            {filteredRows.length > 0 && bulk.isAllVisibleSelected(visibleIds) && bulk.count > 0 && (
              <span className="inline-flex items-center gap-3 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                <span>All {filteredRows.length} matching selected</span>
                {bulk.count > filteredRows.length && (
                  <button
                    type="button"
                    onClick={() => bulk.clear()}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:underline"
                  >
                    Deselect all
                  </button>
                )}
              </span>
            )}
            {filteredRows.length > 0 && !bulk.isAllVisibleSelected(visibleIds) && bulk.count > 0 && (
              <button
                type="button"
                onClick={() => bulk.clear()}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:underline"
              >
                Deselect all {bulk.count}
              </button>
            )}
          </div>

          {/* Empty filtered result — different copy than the truly-empty
              state because here the user is staring at zero rows after
              filtering, not at a brand-new org. */}
          {filteredRows.length === 0 ? (
            <Card className="p-10 sm:p-12 text-center" data-testid="members-no-matches">
              <SearchIcon className="h-8 w-8 mx-auto text-slate-400 dark:text-slate-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white mt-3">No matches</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                {search && roleFilter !== 'all'
                  ? <>No one matches <span className="font-medium text-slate-700 dark:text-slate-200">{search}</span> in the <span className="font-medium text-slate-700 dark:text-slate-200">{roleFilter === 'owner' ? 'Owner' : roles.find((r) => r.id === roleFilter)?.title || 'Custom'}</span> filter.</>
                  : search
                    ? <>No one matches <span className="font-medium text-slate-700 dark:text-slate-200">{search}</span>.</>
                    : <>No one in the <span className="font-medium text-slate-700 dark:text-slate-200">{roleFilter === 'owner' ? 'Owner' : roles.find((r) => r.id === roleFilter)?.title || 'Custom'}</span> filter.</>
                }
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear filters
              </button>
            </Card>
          ) : (
            <>
              {/* Active members section */}
              <MembersSection
                title="Members"
                count={filteredActive.length}
                totalCount={activeRows.length}
                emptyHint="No active members match."
                canManage={canManage}
                isOwner={isOwner}
                rows={filteredActive}
                bulk={bulk}
                roles={roles}
                onChangeRole={onChangeRole}
                onRemove={setRemoving}
                onResend={onResend}
                onCancelInvite={setCancelling}
              />

              {/* Pending invitations section — only renders when there
                  are invites to show. Hidden if a filter wipes them
                  all out and the user is looking only at active rows. */}
              {filteredInvites.length > 0 && (
                <MembersSection
                  title="Pending invitations"
                  count={filteredInvites.length}
                  totalCount={inviteRows.length}
                  emptyHint="No invitations match."
                  canManage={canManage}
                  isOwner={isOwner}
                  rows={filteredInvites}
                  bulk={bulk}
                  roles={roles}
                  onChangeRole={onChangeRole}
                  onRemove={setRemoving}
                  onResend={onResend}
                  onCancelInvite={setCancelling}
                  pending
                />
              )}
            </>
          )}
        </>
      )}

      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={load}
      />

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this member?"
        description={
          removing
            ? `${removing.user.email} will lose access to ${activeOrg?.name || 'this organization'}. They can be invited again later.`
            : ''
        }
        confirmText="Remove"
        variant="destructive"
        icon={<Trash2 className="h-5 w-5" />}
        onConfirm={onRemove}
      />

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Cancel this invitation?"
        description={
          cancelling
            ? `${cancelling.inviteeEmail} hasn't registered yet. Cancelling removes the pending invitation — you'll need to invite them again later.`
            : ''
        }
        confirmText="Cancel invitation"
        variant="destructive"
        icon={<MailPlus className="h-5 w-5" />}
        onConfirm={onCancelInvite}
      />

      <ConfirmDialog
        open={!!resending}
        onOpenChange={(o) => !o && setResending(null)}
        title="Resend this invitation?"
        description={
          resending
            ? `We'll mark ${resending.inviteeEmail}'s invitation as freshly sent. No real email goes out in this demo.`
            : ''
        }
        confirmText="Resend invitation"
        variant="default"
        icon={<Send className="h-5 w-5" />}
        onConfirm={async () => { await onResend(resending); setResending(null) }}
      />

      <ConfirmDialog
        open={!!bulkConfirm}
        onOpenChange={(o) => !o && !bulkRunning && setBulkConfirm(null)}
        title={
          bulkConfirm
            ? `Remove ${bulkConfirm.activeTargets.length} member${bulkConfirm.activeTargets.length === 1 ? '' : 's'}` +
              (bulkConfirm.inviteTargets.length
                ? ` and cancel ${bulkConfirm.inviteTargets.length} invitation${bulkConfirm.inviteTargets.length === 1 ? '' : 's'}`
                : '') + '?'
            : ''
        }
        children={bulkConfirm ? (
          <>
            <p className="text-slate-700 dark:text-slate-200 leading-snug">
              {bulkConfirm.activeTargets.length > 0 && (
                <>Members will lose access to {activeOrg?.name || 'this organization'}. </>
              )}
              {bulkConfirm.inviteTargets.length > 0 && (
                <>Pending invitations will be cancelled. </>
              )}
              Anyone affected can be invited again later.
            </p>
            {bulkConfirm.skippedOwners > 0 && (
              <div className="inline-flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {bulkConfirm.skippedOwners} owner{bulkConfirm.skippedOwners === 1 ? '' : 's'} will be skipped — owners can't be removed.
                </span>
              </div>
            )}
          </>
        ) : null}
        confirmText={
          bulkConfirm
            ? `Remove ${bulkConfirm.activeTargets.length}` +
              (bulkConfirm.inviteTargets.length ? ` and cancel ${bulkConfirm.inviteTargets.length}` : '')
            : 'Remove'
        }
        variant="destructive"
        icon={<Trash2 className="h-5 w-5" />}
        onConfirm={onBulkRemove}
        loading={bulkRunning}
      />

      {/* Bulk action tray — fixed-position bottom of the page. Renders
          nothing when selection is empty (gate is inside the component).
          Selection-clears-on-success is enforced via onBulkRemove above. */}
      <BulkActionTray
        rowIds={Array.from(bulk.selection)}
        rows={selectedRows.map((r) => ({
          ...r,
          // BulkActionTray keys its internal lookup on a flat `id`.
          // Members don't expose r.id — active rows use r.user.id and
          // invites use r.inviteeEmail. Flatten it here so the tray's
          // rowById lookup resolves and the chip label renders.
          id: r.kind === 'active' ? r.user.id : r.inviteeEmail,
        }))}
        getRowLabel={(r) => displayName(r) || displayEmail(r)}
        getRowSubLabel={(r) => r.kind === 'active' ? roleLabel(r) : 'Invited'}
        hasHiddenSelection={hasHiddenSelection}
        onRemove={(id) => bulk.remove(id)}
        onClear={() => bulk.clear()}
        currentUser={{ isOwner, canManageMembers: canManage }}
        // Override the tray's default "server"/"servers" noun so the
        // count copy on this page reads "members selected". The /servers
        // caller is untouched.
        rowNounSingular="member"
        rowNounPlural="members"
        selectionEligibility={bulkActionEligibility({
          actionId: 'removeMembers',
          selection: selectedRows,
          currentUser: { isOwner, canManageMembers: canManage },
        })}
        actions={[
          {
            id: 'removeMembers',
            label:
              selectedRows.length === 1 && selectedRows[0].kind === 'invited'
                ? 'Cancel invitation'
                : 'Remove',
            icon: Trash2,
            tooltipWhenEnabled:
              selectedRows.length === 1 && selectedRows[0].kind === 'invited'
                ? 'Cancel this invitation'
                : `Remove ${selectedRows.length} selected (members + pending invites) from this organization`,
            onClick: () => openBulkRemove(),
          },
        ]}
      />
    </PageContainer>
  )
}

// ---------------------------------------------------------------------------
// MembersSection — renders one section (active members OR pending
// invitations). Switches between shadcn Table on md+ and the card-per-
// row layout below md. Same row shape across both views; the only
// difference is which fields get hidden at which breakpoint.
// ---------------------------------------------------------------------------
function MembersSection({
  title,
  count,
  totalCount,
  emptyHint,
  canManage,
  isOwner,
  rows,
  bulk,
  roles,
  onChangeRole,
  onRemove,
  onResend,
  onCancelInvite,
  pending = false,
}) {
  const allSelected = rows.length > 0 && rows.every((r) => {
    const id = r.kind === 'active' ? r.user.id : r.inviteeEmail
    return bulk.has(id)
  })
  const someSelected = rows.some((r) => {
    const id = r.kind === 'active' ? r.user.id : r.inviteeEmail
    return bulk.has(id)
  })

  const onToggleAll = () => {
    if (allSelected) {
      for (const r of rows) {
        const id = r.kind === 'active' ? r.user.id : r.inviteeEmail
        bulk.remove(id)
      }
    } else {
      bulk.selectAllVisible(rows.map((r) => r.kind === 'active' ? r.user.id : r.inviteeEmail))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
          <span className="ml-2 tabular-nums text-slate-400 dark:text-slate-500">
            {count}{count !== totalCount ? ` of ${totalCount}` : ''}
          </span>
        </h2>
      </div>

      {/* Desktop table — md+ */}
      <Card className="p-0 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60 dark:bg-slate-900/60 hover:bg-slate-50/60 dark:hover:bg-slate-900/60">
                <TableHead className="pl-3 pr-1 w-10">
                  {canManage && (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allSelected && someSelected
                      }}
                      onChange={onToggleAll}
                      aria-label={allSelected ? `Deselect all ${title.toLowerCase()}` : `Select all ${title.toLowerCase()}`}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 dark:text-indigo-300 focus:ring-indigo-500/30 cursor-pointer"
                      data-testid={`members-section-select-all-${pending ? 'invites' : 'active'}`}
                    />
                  )}
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
                <TableHead className="w-44">Role</TableHead>
                <TableHead className="hidden lg:table-cell w-36">Joined</TableHead>
                <TableHead className="text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const id = r.kind === 'active' ? r.user.id : r.inviteeEmail
                return (
                  <MembersTableRow
                    key={id}
                    row={r}
                    id={id}
                    selected={bulk.has(id)}
                    onToggleSelect={() => bulk.toggle(id)}
                    canManage={canManage}
                    isOwner={isOwner}
                    roles={roles}
                    onChangeRole={onChangeRole}
                    onRemove={onRemove}
                    onResend={onResend}
                    onCancelInvite={onCancelInvite}
                    pending={pending}
                  />
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile card list — below md. Same row content, but stacked
          vertically so the email + role + actions stay tappable on
          narrow screens. */}
      <Card className="p-0 overflow-hidden md:hidden" data-testid={`members-mobile-${pending ? 'invites' : 'active'}`}>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((r) => {
            const id = r.kind === 'active' ? r.user.id : r.inviteeEmail
            return (
              <MembersMobileRow
                key={id}
                row={r}
                id={id}
                selected={bulk.has(id)}
                onToggleSelect={() => bulk.toggle(id)}
                canManage={canManage}
                isOwner={isOwner}
                roles={roles}
                onChangeRole={onChangeRole}
                onRemove={onRemove}
                onResend={onResend}
                onCancelInvite={onCancelInvite}
                pending={pending}
              />
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// Desktop table row — one row per member/invitation. Renders an
// avatar+name+email column, a role column with the dropdown (or an
// owner badge), a joined column, and an actions column with the
// per-row Remove / Cancel / Resend button.
function MembersTableRow({
  row,
  id,
  selected,
  onToggleSelect,
  canManage,
  isOwner,
  roles,
  onChangeRole,
  onRemove,
  onResend,
  onCancelInvite,
  pending,
}) {
  const me = useAuthStore((s) => s.user)
  const isMe = row.kind === 'active' && row.user.id === me?.id
  const isRowOwner = !!row.isOwner
  const selfRoleLocked = isMe && isRowOwner

  return (
    <TableRow
      className={cn(
        selected && 'bg-indigo-50/60 dark:bg-indigo-500/10 hover:bg-indigo-50 dark:hover:bg-indigo-500/15',
      )}
      data-testid={`members-row-${id}`}
    >
      <TableCell className="pl-3 pr-1 py-3">
        {canManage && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${displayName(row) || displayEmail(row)}`}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 dark:text-indigo-300 focus:ring-indigo-500/30 cursor-pointer"
          />
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3 min-w-0">
          <AvatarCircle row={row} />
          <div className="min-w-0">
            <div className="font-medium text-slate-900 dark:text-white truncate flex items-center gap-2">
              <span className="truncate">{displayName(row)}</span>
              {isMe && (
                <Badge variant="indigo" className="rounded-md text-xxs uppercase tracking-wider shrink-0">
                  You
                </Badge>
              )}
              {pending && (
                <Badge variant="warning" size="sm" className="shrink-0">
                  <Clock className="h-3 w-3 mr-1" />
                  Invited
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate lg:hidden">
              {displayEmail(row)}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <p className="text-sm text-slate-700 dark:text-slate-200 truncate max-w-xs">
          {displayEmail(row)}
        </p>
      </TableCell>
      <TableCell>
        {isRowOwner ? (
          <OwnerBadge />
        ) : canManage && !pending ? (
          <RoleSelectDropdown
            value={row.roleId}
            roles={roles}
            onChange={(rid) => onChangeRole(row, rid)}
            disabled={selfRoleLocked}
            className="!min-w-[7rem] sm:!min-w-[8.5rem]"
          />
        ) : canManage && pending ? (
          <RoleSelectDropdown
            value={row.roleId}
            roles={roles}
            onChange={(rid) => onChangeRole(row, rid)}
            className="!min-w-[7rem] sm:!min-w-[8.5rem]"
          />
        ) : (
          <Badge variant="indigo" className="rounded-md text-2xs font-medium gap-1 px-2.5 py-1">
            <Shield className="h-3 w-3" />
            {roleLabel(row)}
          </Badge>
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {timeAgo(row.joinedAt || row.invitedAt)}
        </p>
        {pending && (() => {
          const exp = inviteExpiry(row)
          if (!exp) return null
          return (
            <p
              className={cn('text-2xs tabular-nums mt-0.5', exp.tone)}
              title={exp.title}
              data-testid={`members-expiry-${id}`}
            >
              {exp.label}
            </p>
          )
        })()}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center justify-end gap-1">
          {pending && canManage && (
            <button
              type="button"
              onClick={() => onResend?.(row)}
              aria-label={`Resend invitation to ${displayEmail(row)}`}
              title={`Resend invitation`}
              data-testid={`members-resend-${id}`}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
          {!isRowOwner && canManage && !pending && (
            <button
              type="button"
              onClick={() => onRemove?.(row)}
              aria-label={`Remove ${displayEmail(row)}`}
              title={`Remove ${displayEmail(row)}`}
              data-testid={`members-remove-${id}`}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {pending && canManage && (
            <button
              type="button"
              onClick={() => onCancelInvite?.(row)}
              aria-label={`Cancel invitation to ${displayEmail(row)}`}
              title={`Cancel invitation to ${displayEmail(row)}`}
              data-testid={`members-cancel-${id}`}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

// Mobile card row — same row content, stacked. Used below md.
function MembersMobileRow({
  row,
  id,
  selected,
  onToggleSelect,
  canManage,
  isOwner,
  roles,
  onChangeRole,
  onRemove,
  onResend,
  onCancelInvite,
  pending,
}) {
  const me = useAuthStore((s) => s.user)
  const isMe = row.kind === 'active' && row.user.id === me?.id
  const isRowOwner = !!row.isOwner
  const selfRoleLocked = isMe && isRowOwner

  return (
    <div
      className={cn(
        'px-4 py-3 flex items-start gap-3 min-w-0',
        selected && 'bg-indigo-50/60 dark:bg-indigo-500/10',
        isMe && !selected && 'bg-indigo-50/60 dark:bg-indigo-500/10',
      )}
    >
      {canManage && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${displayName(row) || displayEmail(row)}`}
          className="h-4 w-4 mt-3 rounded border-slate-300 dark:border-slate-600 text-indigo-600 dark:text-indigo-300 focus:ring-indigo-500/30 cursor-pointer shrink-0"
        />
      )}
      <AvatarCircle row={row} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-medium text-slate-900 dark:text-white truncate flex items-center gap-2 min-w-0">
            <span className="truncate">{displayName(row)}</span>
            {isMe && (
              <Badge variant="indigo" className="rounded-md text-xxs uppercase tracking-wider shrink-0">
                You
              </Badge>
            )}
            {pending && (
              <Badge variant="warning" size="sm" className="shrink-0">
                <Clock className="h-3 w-3 mr-1" />
                Invited
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
          <Mail className="h-3 w-3" />
          {displayEmail(row)}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            {isRowOwner ? (
              <OwnerBadge />
            ) : canManage ? (
              <RoleSelectDropdown
                value={row.roleId}
                roles={roles}
                onChange={(rid) => onChangeRole(row, rid)}
                disabled={selfRoleLocked}
                className="!min-w-[7rem] !h-8"
              />
            ) : (
              <Badge variant="indigo" className="rounded-md text-2xs font-medium gap-1 px-2.5 py-1">
                <Shield className="h-3 w-3" />
                {roleLabel(row)}
              </Badge>
            )}
            <span className="text-2xs text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
              {timeAgo(row.joinedAt || row.invitedAt)}
              {pending && (() => {
                const exp = inviteExpiry(row)
                if (!exp) return null
                return (
                  <>
                    {' · '}
                    <span
                      className={exp.tone}
                      title={exp.title}
                      data-testid={`members-expiry-mobile-${id}`}
                    >
                      {exp.label}
                    </span>
                  </>
                )
              })()}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {pending && canManage && (
              <button
                type="button"
                onClick={() => onResend?.(row)}
                aria-label={`Resend invitation to ${displayEmail(row)}`}
                className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
            {!isRowOwner && canManage && !pending && (
              <button
                type="button"
                onClick={() => onRemove?.(row)}
                aria-label={`Remove ${displayEmail(row)}`}
                className="p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {pending && canManage && (
              <button
                type="button"
                onClick={() => onCancelInvite?.(row)}
                aria-label={`Cancel invitation to ${displayEmail(row)}`}
                className="p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// AvatarCircle — shared by table + mobile views. Active members get
// the indigo→purple gradient; invited placeholders get amber→orange.
function AvatarCircle({ row, size = 'sm' }) {
  const dim = size === 'md' ? 'h-10 w-10' : 'h-9 w-9'
  const isActive = row.kind === 'active'
  return (
    <div
      aria-hidden
      className={cn(
        dim,
        'rounded-full flex items-center justify-center text-white font-semibold shrink-0',
        isActive
          ? 'bg-gradient-to-br from-indigo-500 to-purple-700'
          : 'bg-gradient-to-br from-amber-400 to-orange-600',
      )}
    >
      {rowInitials(row)}
    </div>
  )
}

function OwnerBadge() {
  return (
    <Badge variant="warning" className="rounded-md text-2xs font-medium gap-1 px-2.5 py-1">
      <Crown className="h-3 w-3" />
      Owner
    </Badge>
  )
}