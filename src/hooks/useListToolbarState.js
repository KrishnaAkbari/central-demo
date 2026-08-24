/**
 * useListToolbarState — centralizes the search-input + debounced-search
 * + clear-all-filters plumbing shared by every list page.
 *
 * Each page mounts `searchInput` and `search` separately so consumers
 * see the typed value (input) instantly while the filtered list reads
 * the debounced value. Clear-filter goes through a single `reset()`
 * callback.
 *
 * Usage:
 *   const tb = useListToolbarState({
 *     defaultDebounceMs: 200,
 *     initialSearch: '',
 *   })
 *   <ListToolbar
 *     searchInput={tb.searchInput}
 *     onSearchInputChange={tb.setSearchInput}
 *     filtersActive={tb.isAnyActive(search, sort, roleFilter)}
 *     onClearFilters={() => tb.clear(() => { setSearchInput(''); setRoleFilter('all'); setSort('name') })}
 *   />
 *
 * `clear(resetter)` calls the provided callback to reset page-specific
 * state then clears `searchInput`/`search` itself.
 */

import { useEffect, useRef, useState } from 'react'

export function useListToolbarState({
  defaultDebounceMs = 200,
  initialSearch = '',
} = {}) {
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [search, setSearch] = useState(initialSearch)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(searchInput), defaultDebounceMs)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [searchInput, defaultDebounceMs])

  /**
   * `isAnyActive(values...)` returns true if ANY value is "active"
   * (non-empty string, non-empty array, or strict-not-equal to its
   * default). Useful for the toolbar's "Clear filters" visibility.
   *
   * Usage:
   *   filtersActive={tb.isAnyActive(search, sort !== 'name', roleFilter !== 'all')}
   */
  const isAnyActive = (...flags) => flags.some(Boolean)

  const clear = (resetter) => {
    if (typeof resetter === 'function') resetter()
    setSearchInput('')
    setSearch('')
  }

  return {
    searchInput,
    setSearchInput,
    search,
    isAnyActive,
    clear,
  }
}
