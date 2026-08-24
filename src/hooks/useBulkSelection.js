'use client'

import { useCallback, useMemo, useState } from 'react'

// useBulkSelection — selection state for bulk-action UIs.
//
// Owns a Set<id> under the hood so add / remove / toggle are O(1).
// Designed to be filter-aware: the caller passes the "visible" set
// each render so the hook knows which rows are currently shown, used
// by selectAllVisible and the `hasHiddenSelection` computation.
//
// Persisted across filter changes by design — that's the documented
// UX rule (a row stays in the selection even when the active filter
// hides it, so the user can change views without losing their batch).
//
// Returned surface:
//   selection      — Set<id>
//   count          — selection.size
//   has(id)        — boolean
//   isAllVisibleSelected(visibleIds) — boolean
//   hasHiddenSelection(visibleIds)   — boolean (any selected not visible)
//   add(id), remove(id), toggle(id), clear(), selectAllVisible(visibleIds),
//   setSelection(ids)
//
// The returned object identity is memoized; the inner `selection` Set
// changes on each mutation. Consumers should iterate `selection.has(id)`
// rather than rely on Set identity.
export function useBulkSelection() {
  const [selection, setSelection] = useState(() => new Set())

  const add = useCallback((id) => {
    if (!id) return
    setSelection((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const remove = useCallback((id) => {
    if (!id) return
    setSelection((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const toggle = useCallback((id) => {
    if (!id) return
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setSelection((prev) => (prev.size === 0 ? prev : new Set()))
  }, [])

  // Add every visible id to the selection. Existing selection is
  // preserved (rows hidden by filter stay selected).
  const selectAllVisible = useCallback((visibleIds) => {
    if (!Array.isArray(visibleIds) || visibleIds.length === 0) return
    setSelection((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const id of visibleIds) {
        if (!next.has(id)) { next.add(id); changed = true }
      }
      return changed ? next : prev
    })
  }, [])

  // Replace the selection entirely with the given ids. Used by the
  // "Select all matching" link to set the selection when it was empty.
  const setMany = useCallback((ids) => {
    setSelection((prev) => {
      const next = ids instanceof Set ? ids : new Set(ids || [])
      if (next.size === prev.size) {
        let same = true
        for (const id of prev) if (!next.has(id)) { same = false; break }
        if (same) return prev
      }
      return next
    })
  }, [])

  const has = useCallback((id) => selection.has(id), [selection])

  // All currently-visible ids are in the selection. Pass the rendered
  // row list so we don't have to track visibility inside the hook.
  const isAllVisibleSelected = useCallback(
    (visibleIds) => {
      if (!Array.isArray(visibleIds) || visibleIds.length === 0) return false
      for (const id of visibleIds) if (!selection.has(id)) return false
      return true
    },
    [selection],
  )

  // Any selected id is not in the visibleIds array. Used to show the
  // "(some may be hidden by current filter)" hint under the count.
  const hasHiddenSelection = useCallback(
    (visibleIds) => {
      if (!Array.isArray(visibleIds) || visibleIds.length === 0) {
        return selection.size > 0
      }
      const visible = new Set(visibleIds)
      for (const id of selection) if (!visible.has(id)) return true
      return false
    },
    [selection],
  )

  return useMemo(
    () => ({
      selection,
      count: selection.size,
      has,
      add,
      remove,
      toggle,
      clear,
      selectAllVisible,
      setSelection: setMany,
      isAllVisibleSelected,
      hasHiddenSelection,
    }),
    [selection, has, add, remove, toggle, clear, selectAllVisible, setMany, isAllVisibleSelected, hasHiddenSelection],
  )
}
