'use client'

import { useState } from 'react'
import {
  X as XIcon,
  MoreHorizontal as MoreHorizontalIcon,
  ChevronRight,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/utils'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { bulkActionEligibility } from '@/lib/bulk-eligibility'

// BulkActionTray — slim fixed-position tray at the bottom of the page
// that hosts bulk-action buttons. Renders nothing when the selection
// is empty, so consumers don't need to gate mounting.
//
// Used by:
//   * /servers list — first consumer, action "shareServerAccess"
//   * future /applications /databases /members lists — same pattern
//
// Props:
//   rowIds           — string[]: ids of currently selected rows
//   rows             — row[]: matching row objects, for label rendering
//                      and per-row eligibility. The `id` field on each
//                      row must match the ids in rowIds.
//   getRowLabel      — (row) => string (required): chip label
//   getRowSubLabel   — (row) => string (optional): secondary text under
//                      the label
//   hasHiddenSelection — boolean: tray shows "some may be hidden by
//                        current filter" hint when true
//   onRemove         — (id) => void: remove a single row from selection
//   onClear          — () => void: clear all
//   actions          — action[]: { id, label, icon?, onClick(rowIds),
//                       tooltipWhenEnabled?, secondary?: boolean }
//                      First action with secondary:false (or absent) is
//                      the primary; remainder go into a "..." overflow
//                      menu. Maximum 3 visible (primary + 2 secondary)
//                      to avoid button clutter.
//   currentUser      — { isOwner, canManageServers } for eligibility
//   selectionEligibility — { eligibleCount, total, verb, reason }
//                      Pre-computed result for the dominant action.
//                      When eligibleCount < total, the tray shows
//                      "N of M shareable" and the primary button is
//                      disabled. This surfaces mixed-ownership at a
//                      glance rather than only on hover.
//   menuLabel        — string, defaults to "More actions"
//   className        — optional override for outer container
//
// Eligibility: each action is gated by bulkActionEligibility. Disabled
// state shows a tooltip explaining why. We never silently filter out
// ineligible rows — the count and eligibility gap surface in the
// tooltip, so the user knows exactly what's possible.
//
// Visual:
//   - Mounts from the bottom (200ms ease-out fade + slide up). Uses
//     the same `animate-fade-in` keyframe already defined in globals.css
//     so the motion family matches the rest of the app.
//   - Pill chips with indigo tint; +N more overflow chip after 5.
//   - On mobile (< sm), the chip list scrolls horizontally inside the
//     tray and the action buttons take a full-width row below.
export function BulkActionTray({
  rowIds = [],
  rows = [],
  getRowLabel,
  getRowSubLabel,
  hasHiddenSelection = false,
  onRemove,
  onClear,
  actions = [],
  currentUser,
  selectionEligibility,
  menuLabel = 'More actions',
  // Noun used in the count label. Defaults to 'server' for backwards
  // compatibility with the /servers and /members callers.
  rowNounSingular = 'server',
  rowNounPlural = 'servers',
  className,
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  // Build a row lookup for chips and label rendering.
  const rowById = new Map()
  if (Array.isArray(rows)) for (const r of rows) if (r && r.id != null) rowById.set(r.id, r)
  // Some consumers pass rows as a Map already; handle both.
  if (rows && typeof rows === 'object' && !Array.isArray(rows) && typeof rows.get === 'function') {
    for (const id of rowIds) {
      const r = rows.get(id)
      if (r && r.id != null) rowById.set(r.id, r)
    }
  }

  // Selection row objects in selection-order. Stable: walk rowIds so
  // the chip list reflects the order the user picked (matches Gmail).
  const selectedRows = []
  const seen = new Set()
  for (const id of rowIds) {
    if (seen.has(id)) continue
    seen.add(id)
    const row = rowById.get(id) || { id, name: id }
    selectedRows.push(row)
  }

  if (selectedRows.length === 0) return null

  const count = selectedRows.length
  const VISIBLE_CHIP_LIMIT = 5
  const visibleChips = selectedRows.slice(0, VISIBLE_CHIP_LIMIT)
  const overflowCount = selectedRows.length - visibleChips.length

  // Split actions: first is primary (visible button), the rest go in
  // the "..." overflow. Callers can mark an action `secondary: true`
  // to demote it even if it appears first.
  const primary = []
  const overflow = []
  for (const a of actions) {
    if (primary.length === 0 && !a.secondary) primary.push(a)
    else overflow.push(a)
  }

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      aria-live="polite"
      data-testid="bulk-action-tray"
      className={cn(
        "fixed inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4 z-40",
        "max-w-3xl mx-auto",
        "animate-fade-in",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-2xl shadow-2xl",
          "bg-white dark:bg-slate-900",
          "border border-indigo-300 dark:border-indigo-500/40",
          "ring-4 ring-indigo-500/10",
          "px-3 py-2.5 sm:px-4 sm:py-3",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Count + hidden-by-filter hint */}
          <div className="flex items-center gap-2 shrink-0">
            <span
              aria-hidden
              className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-indigo-600 text-white text-xs font-semibold tabular-nums"
            >
              {count}
            </span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {count === 1 ? rowNounSingular : rowNounPlural} selected
              {hasHiddenSelection && (
                <span className="block text-2xs font-normal text-slate-500 dark:text-slate-400 leading-tight">
                  some may be hidden by current filter
                </span>
              )}
              {selectionEligibility && selectionEligibility.total > 0 && selectionEligibility.eligibleCount < selectionEligibility.total && (
                <span
                  className="block text-2xs font-normal text-amber-700 dark:text-amber-300 leading-tight"
                  title={selectionEligibility.reason}
                >
                  {selectionEligibility.eligibleCount} of {selectionEligibility.total} {selectionEligibility.verb}
                </span>
              )}
            </span>
          </div>

          {/* Chip list — horizontal scroll on overflow, max 5 visible chips.
              On mobile (default) chips take the full next row. */}
          <div className="order-3 sm:order-2 flex-1 min-w-0 basis-full sm:basis-auto flex items-center gap-1.5 overflow-x-auto py-0.5">
            {visibleChips.map((row) => (
              <Chip
                key={row.id}
                label={getRowLabel ? getRowLabel(row) : row.name || row.id}
                subLabel={getRowSubLabel ? getRowSubLabel(row) : null}
                onRemove={onRemove ? () => onRemove(row.id) : null}
              />
            ))}
            {overflowCount > 0 && (
              <span className="inline-flex items-center h-7 px-2.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 shrink-0">
                +{overflowCount} more
              </span>
            )}
          </div>

          {/* Action area — clears on the right; on mobile it sits in its
              own row above the chip list (order-2). */}
          <div className="order-2 sm:order-3 flex items-center gap-2 shrink-0 w-full sm:w-auto">
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:hover:text-white px-2"
                aria-label="Clear selection"
              >
                Clear
              </button>
            )}

            {primary.map((action) => (
              <BulkActionButton
                key={action.id}
                action={action}
                selection={selectedRows}
                currentUser={currentUser}
                selectionEligibility={action.id === 'shareServerAccess' ? selectionEligibility : null}
              />
            ))}

            {overflow.length > 0 && (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
                <DropdownMenuTrigger
                  className={cn(
                    "inline-flex items-center justify-center h-8 w-8 rounded-md border border-slate-200 dark:border-slate-700",
                    "bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white dark:text-slate-400 dark:hover:text-white",
                    "hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800/40 transition-colors",
                  )}
                  aria-label={menuLabel}
                  title={menuLabel}
                >
                  <MoreHorizontalIcon className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {overflow.map((action) => (
                    <OverflowActionItem
                      key={action.id}
                      action={action}
                      selection={selectedRows}
                      currentUser={currentUser}
                    />
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Internal: chip + button renderers
// ---------------------------------------------------------------------------

function Chip({ label, subLabel, onRemove }) {
  return (
    <span className="inline-flex items-center h-7 pl-2.5 pr-1 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 text-xs font-medium shrink-0 max-w-[200px]">
      <span className="truncate" title={label}>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} from selection`}
          className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-indigo-200/60 dark:hover:bg-indigo-500/30 shrink-0"
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

function BulkActionButton({ action, selection, currentUser, selectionEligibility }) {
  const elig = bulkActionEligibility({
    actionId: action.id,
    selection,
    currentUser,
  })
  // If a pre-computed selectionEligibility was supplied and it
  // indicates partial eligibility (some rows aren't actionable), the
  // button is disabled even when bulkActionEligibility says enabled
  // globally — because clicking would attempt to act on ineligible
  // rows. The pre-computed result wins.
  const partialMismatch = selectionEligibility
    && selectionEligibility.total > 0
    && selectionEligibility.eligibleCount < selectionEligibility.total
  const effectivelyEnabled = elig.enabled && !partialMismatch
  const tooltip = !effectivelyEnabled
    ? (partialMismatch ? selectionEligibility.reason : (elig.reason || action.label))
    : (action.tooltipWhenEnabled || action.label)
  const Icon = action.icon
  return (
    <Button
      size="sm"
      onClick={() => effectivelyEnabled && action.onClick?.(selection.map((r) => r.id))}
      disabled={!effectivelyEnabled}
      title={tooltip}
      aria-label={tooltip}
      data-testid={`bulk-action-${action.id}`}
      className="shrink-0"
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      <span className="hidden sm:inline">{action.label}</span>
    </Button>
  )
}

function OverflowActionItem({ action, selection, currentUser }) {
  const elig = bulkActionEligibility({
    actionId: action.id,
    selection,
    currentUser,
  })
  const Icon = action.icon
  return (
    <DropdownMenuItem
      disabled={!elig.enabled}
      onClick={() => elig.enabled && action.onClick?.(selection.map((r) => r.id))}
      title={elig.enabled ? action.tooltipWhenEnabled || action.label : elig.reason}
      className={cn("gap-2")}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      <span>{action.label}</span>
      {!elig.enabled && (
        <ChevronRight className="ml-auto h-3 w-3 text-slate-400 dark:text-slate-500" aria-hidden />
      )}
    </DropdownMenuItem>
  )
}
