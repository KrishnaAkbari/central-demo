'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * TypeaheadInput — single-line input with a typeahead popover.
 *
 * Renders the search icon, the text input, an optional clear button, and a
 * suggestion popover that appears below the input as the user types.
 *
 * The popover is rendered via `createPortal` at `document.body` so it
 * escapes every ancestor's overflow/clipping context. The /audit toolbar
 * (and any other toolbar that wraps content in a Card) would otherwise
 * clip the popover with the Card's default `overflow-hidden`. Position is
 * recalculated from the input's bounding rect on every scroll and resize
 * so the popover stays visually anchored to the input even when the
 * surrounding layout moves.
 *
 * Behavior:
 *   - As soon as the user has typed >= 1 character AND there are matching
 *     suggestions, the popover shows the top 5 matches (case-insensitive
 *     substring).
 *   - Up/Down arrow keys move the highlighted row. Enter applies the
 *     highlighted row (sets the input value and closes the popover). Escape
 *     closes the popover. Clicking outside the input AND the popover also
 *     closes it (the portalled popover is treated as "inside" so clicks
 *     on suggestions don't dismiss them).
 *   - The matching substring inside each row is rendered in the indigo
 *     primary color so the user can see why that row matched.
 *
 * Usage:
 *   <TypeaheadInput
 *     value={search}
 *     onChange={setSearch}
 *     placeholder="Search servers…"
 *     ariaLabel="Search servers"
 *     suggestions={serverNames}
 *   />
 *
 *   The parent owns the input value AND the source-of-truth list. The
 *   component only filters the suggestions list against the current input.
 *   That keeps the data flow one-way (parent -> popover) and lets pages
 *   keep their existing useEffect / useState wiring.
 */
export function TypeaheadInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  suggestions,
  className = '',
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const [popoverStyle, setPopoverStyle] = React.useState(null)
  const [mounted, setMounted] = React.useState(false)
  const containerRef = React.useRef(null)
  const popoverRef = React.useRef(null)

  // createPortal needs document.body; only available after mount.
  React.useEffect(() => { setMounted(true) }, [])

  const q = (value || '').trim().toLowerCase()
  const topSuggestions = React.useMemo(() => {
    if (!suggestions || !q) return []
    return suggestions.filter((s) => s && s.toLowerCase().includes(q)).slice(0, 5)
  }, [q, suggestions && suggestions.join('\n')])

  const shouldShow = isOpen && topSuggestions.length > 0

  // Compute + keep the popover's fixed position in sync with the input.
  // useLayoutEffect so the popover doesn't flash at (0,0) on first show.
  React.useLayoutEffect(() => {
    if (!shouldShow || !containerRef.current) {
      setPopoverStyle(null)
      return
    }
    const update = () => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setPopoverStyle({
        position: 'fixed',
        top: rect.bottom + 4, // mt-1 = 4px gap below the input
        left: rect.left,
        width: rect.width,
        zIndex: 50,
      })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [shouldShow, value])

  React.useEffect(() => { setHighlightedIndex(0) }, [q])

  // Click-outside handler — treats both the input wrapper and the
  // portalled popover as "inside" so clicks on a suggestion don't
  // immediately dismiss the popover before the suggestion's onClick fires.
  React.useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      const inContainer = containerRef.current && containerRef.current.contains(e.target)
      const inPopover = popoverRef.current && popoverRef.current.contains(e.target)
      if (!inContainer && !inPopover) {
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

  const popoverNode = shouldShow && popoverStyle && (
    <div
      ref={popoverRef}
      style={popoverStyle}
      data-typeahead-popover=""
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg overflow-hidden"
    >
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
  )

  return (
    <div ref={containerRef} className={`relative flex-1 min-w-[200px] ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      <Input
        placeholder={placeholder}
        value={value || ''}
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
      {mounted && popoverNode && createPortal(popoverNode, document.body)}
    </div>
  )
}