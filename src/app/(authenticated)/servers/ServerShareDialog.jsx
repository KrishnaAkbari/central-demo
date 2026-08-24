'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

// =============================================================================
// ServerShareDialog — Gmail Drive-style "share server access" modal
// =============================================================================
//
// Owner-only by design (gated by `assertCanManageServerAccess` server-side;
// `useIsOwner()` hides the trigger button client-side). The mental model
// is "share a Google Doc", NOT "edit 40 permission checkboxes":
//
//   1. Email field → resolves to a real user (or shows "no account")
//   2. Access level → 3 readable presets: View / Full / Custom
//   3. Done → one button: "Share access" / "Update access"
//
// Two modes:
//   - `add`  → blank slate, default level = "Full access"
//   - `edit` → pre-populated from existing row, adds "Remove access" CTA
//
// Scope: only server.* + application.* permissions are selectable.
// Organization-level perms are rejected by `shareServerAccess` API layer.
//
// Server count: dialog supports N servers at once (used by detail page
// for one, and was also callable from bulk flows). The dialog title
// adapts: "1 server" vs "N servers" and shows a tooltip with names.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Mail, User as UserIcon, Loader2, CheckCircle2, XCircle,
  ChevronDown, ChevronRight,
  AlertCircle, X as XIcon, Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { showToast } from '@/utils/toast-utils'
import { cn } from '@/utils'

import * as api from '@/services/centralApi'
import { PERMISSIONS } from '@/lib/permissions'

// -----------------------------------------------------------------------------
// Permission presets
// -----------------------------------------------------------------------------
//
// Three levels, in this order. `id` is the radio key, `description` is
// the one-line summary shown on the preset card, `descriptionLong` is
// the tooltip on hover.
//
// `compute(level)` returns the effective permissions[] that should be
// granted when the preset is chosen.
//
// "view"   = all server.*.view + application.*.view permissions
// "full"   = all server.* + application.* permissions
// "custom" = whatever the user has toggled in the Custom panel
// -----------------------------------------------------------------------------

// Build the shareable permission set once at module load. Returns both
// the flat list of composite keys (for default selection + submit) and
// the grouped view (for the picker UI). Excludes organization-level
// entirely — those stay owner-only by design.
function buildShareablePermissions() {
  const filtered = PERMISSIONS.filter(
    (p) => p.level === 'server' || p.level === 'application',
  )
  const groups = {}
  for (const p of filtered) {
    const key = `${p.level}::${p.sub_level}`
    if (!groups[key]) groups[key] = { level: p.level, sub_level: p.sub_level, items: [] }
    groups[key].items.push(p)
  }
  const groupsList = Object.values(groups).sort((a, b) => {
    const lv = (a.level === 'application' ? 0 : 1) - (b.level === 'application' ? 0 : 1)
    if (lv !== 0) return lv
    return a.sub_level.localeCompare(b.sub_level)
  })
  return {
    permissionIds: filtered.map((p) => p.name),
    groups: groupsList,
    count: filtered.length,
  }
}

// Single source of truth for the dialog's permission surface. Only
// server.* + application.* are shareable; organization-level perms
// stay owner-only by design (no permission unlocks server sharing).
const ALL_SHAREABLE = buildShareablePermissions()

// Default initial selection for add mode: pre-check every shareable
// permission. The user grants full access by default and unticks what
// they don't want — the inverse of "start empty, opt-in", which felt
// tedious in early testing. Edit mode overrides this with the user's
// current permissions[].
const DEFAULT_SHAREABLE_IDS = ALL_SHAREABLE.permissionIds

// Grouped view for the picker. Each group = one `${level}::${sub_level}`.
// Excludes organization-level entirely.
const CUSTOM_GROUPS = ALL_SHAREABLE.groups

function humanizeSubLevel(subLevel, level) {
  // Context-aware label so the same word (e.g. "integration") reads
  // right in different levels.
  if (subLevel === 'integration') {
    if (level === 'server') return 'Integrations'
    if (level === 'application') return 'Cloudflare'
    return 'Cloud Providers'
  }
  return subLevel
    .split('_')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ')
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ServerShareDialog({
  open,
  onOpenChange,
  mode = 'add',                // 'add' | 'edit'
  serverIds = [],              // string[] (1+)
  serverNames = [],            // string[] matching serverIds
  userId: initialUserId = null,
  initialPermissions = [],     // for edit mode
  initialUser = null,          // pre-hydrated user object (edit mode only)
  onSuccess,
}) {
  // ----- Email + user lookup ------------------------------------------------
  const [emailInput, setEmailInput] = useState('')
  const [lookupState, setLookupState] = useState('idle') // idle | looking | found | notfound | error
  const [lookupError, setLookupError] = useState(null)
  const [resolvedUser, setResolvedUser] = useState(initialUser) // { id, email, name } | null
  const lookupTimerRef = useRef(null)

  // ----- Permission selection -----------------------------------------------
  // The dialog has a single mode: direct permission selection. The
  // user sees the full grouped picker and toggles whichever
  // permissions they want to grant. Add mode pre-checks all shareable
  // permissions; edit mode pre-checks the user's current row.
  const [customSelected, setCustomSelected] = useState(() => new Set(initialPermissions))

  // ----- Expanded groups in picker -----------------------------------------
  const [expandedGroups, setExpandedGroups] = useState(() => new Set())

  // ----- Submitting ---------------------------------------------------------
  const [submitting, setSubmitting] = useState(false)
  const [removing, setRemoving] = useState(false)

  // ---------------------------------------------------------------------------
  // Hydrate when dialog opens
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return
    // Reset transient state on open
    setSubmitting(false)
    setRemoving(false)
    setLookupError(null)
    setExpandedGroups(new Set())
    if (mode === 'edit' && initialUser) {
      // Edit mode: email + user are pre-known, pre-check the user's
      // current permissions so they can see exactly what they have.
      setResolvedUser(initialUser)
      setEmailInput(initialUser.email)
      setLookupState('found')
      setCustomSelected(new Set(initialPermissions))
    } else {
      // Add mode: pre-check every shareable permission. The user can
      // untick anything they don't want to grant.
      setEmailInput('')
      setResolvedUser(null)
      setLookupState('idle')
      setCustomSelected(new Set(DEFAULT_SHAREABLE_IDS))
    }
    // Don't depend on initialUser/initialPermissions — they're stable
    // for the lifetime of the dialog open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  // ---------------------------------------------------------------------------
  // Debounced email lookup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (mode === 'edit') return // skip — user already resolved
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current)
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed) {
      setLookupState('idle')
      setResolvedUser(null)
      setLookupError(null)
      return
    }
    // Light client-side check: must look like an email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setLookupState('idle')
      setResolvedUser(null)
      return
    }
    setLookupState('looking')
    lookupTimerRef.current = setTimeout(async () => {
      try {
        const user = await api.lookupUserByEmail(trimmed)
        if (user) {
          setResolvedUser(user)
          setLookupState('found')
          setLookupError(null)
        } else {
          setResolvedUser(null)
          setLookupState('notfound')
          setLookupError('No account found with that email.')
        }
      } catch (err) {
        setLookupState('error')
        setLookupError(err?.message || 'Lookup failed.')
      }
    }, 350)
    return () => { if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current) }
  }, [emailInput, mode])

  // ---------------------------------------------------------------------------
  // Computed: the permissions[] we'd submit right now. The dialog has
  // a single mode — direct selection — so submit === customSelected.
  // ---------------------------------------------------------------------------
  const submitPermissions = useMemo(
    () => Array.from(customSelected),
    [customSelected],
  )

  // ---------------------------------------------------------------------------
  // Custom panel: group-level and item-level toggles
  // ---------------------------------------------------------------------------
  const toggleGroupAll = (group, action) => {
    setCustomSelected((prev) => {
      const next = new Set(prev)
      const target = group.items.filter((p) => p.action === action).map((p) => p.name)
      const allOn = target.length > 0 && target.every((id) => next.has(id))
      if (allOn) for (const id of target) next.delete(id)
      else for (const id of target) next.add(id)
      return next
    })
  }

  const toggleItem = (id) => {
    setCustomSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const canSubmit = !!resolvedUser && submitPermissions.length > 0 && !submitting && !removing

  const handleShare = async () => {
    if (!resolvedUser) return
    setSubmitting(true)
    try {
      await api.shareServerAccess({
        serverIds,
        userId: resolvedUser.id,
        permissions: submitPermissions,
      })
      const who = resolvedUser.email
      const what = serverIds.length === 1 ? `1 server` : `${serverIds.length} servers`
      showToast.success(mode === 'edit' ? `Updated ${who}'s access on ${what}.` : `Shared ${what} with ${who}.`)
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      showToast.error(err?.message || 'Could not save access.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async () => {
    if (!resolvedUser) return
    if (!window.confirm(`Remove ${resolvedUser.email}'s access to ${serverIds.length === 1 ? 'this server' : `these ${serverIds.length} servers`}?`)) return
    setRemoving(true)
    try {
      await api.unshareServerAccess({ serverIds, userId: resolvedUser.id })
      showToast.success(`Removed access.`)
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      showToast.error(err?.message || 'Could not remove access.')
    } finally {
      setRemoving(false)
    }
  }

  if (!open) return null

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const isEdit = mode === 'edit'
  const submitLabel = isEdit ? 'Update access' : 'Share access'
  const serverCount = serverIds.length

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className={cn(
          "bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full",
          "max-w-xl max-h-[90vh] flex flex-col overflow-hidden",
          "border border-slate-200 dark:border-slate-800"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================ HEADER ============================ */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 id="share-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                {isEdit ? 'Manage access' : 'Share access'}
              </h2>
              <p
                className="mt-1 text-sm text-slate-500 dark:text-slate-400"
                title={serverNames.join(', ')}
              >
                {serverCount === 1
                  ? <>Sharing <span className="font-medium text-slate-700 dark:text-slate-200">{serverNames[0] || 'this server'}</span></>
                  : <>Sharing <span className="font-medium text-slate-700 dark:text-slate-200">{serverCount} servers</span></>}
                {' · '}
                <span className="tabular-nums">{submitPermissions.length}</span> of {ALL_SHAREABLE.count} permission{ALL_SHAREABLE.count === 1 ? '' : 's'} selected
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Close"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ============================ BODY ============================== */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ---- Section 1: Email ---- */}
          <section>
            <label htmlFor="share-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Share with
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                id="share-email"
                type="email"
                autoComplete="off"
                placeholder="user@example.com"
                disabled={isEdit}
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className={cn(
                  "w-full h-10 pl-10 pr-10 rounded-lg border text-sm",
                  "bg-white dark:bg-slate-950 text-slate-900 dark:text-white",
                  "focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500",
                  isEdit
                    ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    : lookupState === 'notfound' || lookupState === 'error'
                      ? "border-red-300 dark:border-red-500/50"
                      : lookupState === 'found'
                        ? "border-emerald-300 dark:border-emerald-500/50"
                        : "border-slate-200 dark:border-slate-700"
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {lookupState === 'looking' && <Loader2 className="h-4 w-4 text-slate-400 dark:text-slate-500 animate-spin" />}
                {lookupState === 'found' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {lookupState === 'notfound' && <XCircle className="h-4 w-4 text-red-500" />}
              </div>
            </div>

            {/* Status row beneath the email field */}
            <div className="mt-2 min-h-[20px]">
              {lookupState === 'found' && resolvedUser && (
                <div className="flex items-center gap-2 text-xs">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-700 text-white text-xxs font-semibold">
                      {(resolvedUser.name || resolvedUser.email).slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-slate-900 dark:text-white truncate">
                    {resolvedUser.name || resolvedUser.email}
                  </span>
                  {resolvedUser.name && (
                    <span className="text-slate-500 dark:text-slate-400 truncate">· {resolvedUser.email}</span>
                  )}
                </div>
              )}
              {(lookupState === 'notfound' || lookupState === 'error') && lookupError && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {lookupError}
                </p>
              )}
              {lookupState === 'idle' && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Enter the email of an existing ServerAvatar Central account.
                </p>
              )}
            </div>
          </section>

          {/* ---- Section 2: Permissions ---- */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Permissions
              </label>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {customSelected.size} of {ALL_SHAREABLE.count} selected
              </span>
            </div>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Toggle the access you want to grant. Defaults to everything below.
            </p>

            {/* Permission picker — direct selection. Grouped by
                sub_level (Integrations / Backups / Database / Server /
                Activity log). Each group is collapsible, with
                per-group "View all" / "Manage all" mini-buttons and
                per-row checkbox + title + action pill + description. */}
            <section className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                  Pick permissions
                </p>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {customSelected.size} selected
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {CUSTOM_GROUPS.map((group) => {
                  const gKey = `${group.level}::${group.sub_level}`
                  const expanded = expandedGroups.has(gKey)
                  const viewItems = group.items.filter((p) => p.action === 'view')
                  const manageItems = group.items.filter((p) => p.action === 'manage')
                  const viewOn = viewItems.length > 0 && viewItems.every((p) => customSelected.has(p.name))
                  const manageOn = manageItems.length > 0 && manageItems.every((p) => customSelected.has(p.name))
                  const selectedInGroup = group.items.filter((p) => customSelected.has(p.name)).length

                  return (
                    <div key={gKey}>
                      <button
                        type="button"
                        onClick={() => setExpandedGroups((prev) => {
                          const next = new Set(prev)
                          if (next.has(gKey)) next.delete(gKey); else next.add(gKey)
                          return next
                        })}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800/50"
                      >
                        {expanded
                          ? <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />}
                        <span className="font-medium text-sm text-slate-800 dark:text-slate-100 flex-1">
                          {humanizeSubLevel(group.sub_level, group.level)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                          {selectedInGroup}/{group.items.length}
                        </span>
                      </button>
                      {expanded && (
                        <div className="px-4 pb-3 space-y-1.5">
                          {/* Section-scoped bulk toggles */}
                          <div className="flex gap-2 pb-1">
                            <button
                              type="button"
                              onClick={() => toggleGroupAll(group, 'view')}
                              className={cn(
                                "text-xxs font-semibold uppercase tracking-wide px-2 py-1 rounded-md border transition-colors",
                                viewOn
                                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/15 dark:border-indigo-500/40 dark:text-indigo-300"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                              )}
                            >
                              View all
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleGroupAll(group, 'manage')}
                              className={cn(
                                "text-xxs font-semibold uppercase tracking-wide px-2 py-1 rounded-md border transition-colors",
                                manageOn
                                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/15 dark:border-indigo-500/40 dark:text-indigo-300"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                              )}
                            >
                              Manage all
                            </button>
                          </div>
                          {group.items.map((p) => {
                            const on = customSelected.has(p.name)
                            return (
                              <label
                                key={p.name}
                                className="flex items-start gap-2.5 py-1 px-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800/50 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => toggleItem(p.name)}
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 dark:text-indigo-300 focus:ring-indigo-500/30"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-800 dark:text-slate-100 font-medium">
                                      {p.title}
                                    </span>
                                    <Badge variant={p.action === 'manage' ? 'indigo' : 'secondary'} className="text-xxs rounded uppercase font-semibold">
                                      {p.action}
                                    </Badge>
                                  </div>
                                  {p.description && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                      {p.description}
                                    </p>
                                  )}
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </section>
        </div>

        {/* ============================ FOOTER ============================ */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0 flex items-center justify-between gap-3">
          {isEdit ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing || submitting}
              className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {removing ? 'Removing…' : 'Remove access'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting || removing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={!canSubmit}
              className="min-w-[120px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  {isEdit ? 'Updating…' : 'Sharing…'}
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}