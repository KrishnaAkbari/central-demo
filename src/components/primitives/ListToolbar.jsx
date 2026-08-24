/**
 * ListToolbar — the chrome shared by /members, /organizations, /audit
 * toolbars. Provides:
 *   - search input with debounced state controlled by the caller
 *   - a slot for arbitrary filter controls (role select, sort select, etc.)
 *   - "Clear filters" pill (visible when filtersActive is true)
 *   - right-aligned results count
 *
 * Filter widgets are owned by each page and passed as children via
 * `filterSlot` (single ReactNode, e.g. a `<div className="flex gap-2">{...}</div>`).
 * Each page owns its own state for those filters, but clearing all of them
 * goes through the `useListToolbarState` hook which knows the keys to reset.
 *
 * Usage:
 *   const tb = useListToolbarState({ clearKeys: () => { setRoleFilter('all'); setSort('name') } })
 *   <ListToolbar
 *     searchInput={tb.searchInput}
 *     onSearchInputChange={tb.setSearchInput}
 *     placeholder="Search organizations…"
 *     onClearFilters={() => { tb.reset(); setRoleFilter('all'); setSort('name') }}
 *     filtersActive={tb.filtersActive('all', sort, roleFilter)}
 *     resultsCount={filtered.length}
 *     totalCount={total}
 *     filterSlot={<>
 *       <select value={roleFilter} ...>...</select>
 *       <select value={sort} ...>...</select>
 *     </>}
 *   />
 */

import React from 'react'
import { Search, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function ListToolbar({
  searchInput,
  onSearchInputChange,
  placeholder = 'Search…',
  searchAriaLabel,
  filtersActive,
  onClearFilters,
  resultsCount,
  totalCount,
  filterSlot,
  suggestions,
}) {
  return (
    <Card className="p-3 sm:p-4 mt-4 border-slate-200 dark:border-slate-700 overflow-visible">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <SearchInput
          value={searchInput}
          onChange={onSearchInputChange}
          placeholder={placeholder}
          ariaLabel={searchAriaLabel || placeholder}
          suggestions={suggestions}
        />

        {filterSlot}

        {filtersActive && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}

        {typeof resultsCount === 'number' && typeof totalCount === 'number' && (
          <p className="ml-auto text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
            {resultsCount} of {totalCount}
          </p>
        )}
      </div>
    </Card>
  )
}

function SearchInput({ value, onChange, placeholder, ariaLabel, suggestions }) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const containerRef = React.useRef(null)

  const q = value.trim().toLowerCase()
  const topSuggestions = React.useMemo(() => {
    if (!suggestions || !q) return []
    return suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 5)
  }, [q, suggestions])

  const shouldShow = isOpen && topSuggestions.length > 0

  React.useEffect(() => { setHighlightedIndex(0) }, [q])

  React.useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const apply = (s) => {
    onChange(s)
    setIsOpen(false)
  }

  const handleKey = (e) => {
    if (!shouldShow) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, topSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (topSuggestions[highlightedIndex]) {
        e.preventDefault()
        apply(topSuggestions[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[200px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKey}
        className="pl-9 pr-9 h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
        aria-label={ariaLabel}
        aria-autocomplete="list"
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); setIsOpen(false) }}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {shouldShow && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg overflow-hidden">
          {topSuggestions.map((s, i) => {
            const lower = s.toLowerCase()
            const idx = lower.indexOf(q)
            const isHighlighted = i === highlightedIndex
            return (
              <button
                key={s + '-' + i}
                type="button"
                onClick={() => apply(s)}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={
                  'w-full text-left px-3 py-2 text-sm truncate transition-colors ' +
                  (isHighlighted
                    ? 'bg-primary-tint text-primary'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800')
                }
              >
                {idx === -1 ? s : (
                  <>
                    {s.slice(0, idx)}
                    <span className="font-semibold text-primary">{s.slice(idx, idx + q.length)}</span>
                    {s.slice(idx + q.length)}
                  </>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
