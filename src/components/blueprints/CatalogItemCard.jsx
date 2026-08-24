'use client'

import { Star, Check, Package, Plus } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Resolve a lucide icon component by name, with a safe fallback
function getIcon(name) {
  if (!name) return Package
  const direct = LucideIcons[name]
  if (direct) return direct
  // PascalCase fallback for kebab-case names
  const pascal = name.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('')
  return LucideIcons[pascal] || Package
}

// Compact star rating — half-stars rounded to nearest 0.5
function StarRating({ value, count, size = 'xs' }) {
  const full = Math.floor(value)
  const half = value - full >= 0.5
  const cls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-3 w-3'
  return (
    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
      <div className="flex items-center gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            className={cn(
              cls,
              i < full
                ? 'fill-amber-400 text-amber-400'
                : i === full && half
                  ? 'fill-amber-400/60 text-amber-400'
                  : 'fill-transparent text-slate-300 dark:text-slate-600',
            )}
          />
        ))}
      </div>
      <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">{value.toFixed(1)}</span>
      {count ? (
        <span className="text-slate-400 dark:text-slate-500">({count > 999 ? `${(count / 1000).toFixed(1)}k` : count})</span>
      ) : null}
    </div>
  )
}

// Format large install counts: 5_000_000 → "5M+"
function formatInstalls(n) {
  if (!n) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M+`
  if (n >= 1_000) return `${(n / 1000).toFixed(0)}k+`
  return `${n}+`
}

// ---------------------------------------------------------------------------
// CatalogItemCard — used by both ThemePicker (theme cards) and PluginPicker
// (plugin rows). Pass `mode="theme"` or `mode="plugin"` to switch layout.
//
// Props:
//   item        — catalog entry (theme or plugin)
//   mode        — "theme" | "plugin"
//   selected    — boolean
//   disabled    — when true, shows as already-selected style
//   onSelect    — click handler
// ---------------------------------------------------------------------------

export function CatalogItemCard({ item, mode, selected = false, disabled = false, onSelect }) {
  const Icon = mode === 'plugin' ? getIcon(item.icon) : null

  if (mode === 'theme') {
    return <ThemeCard item={item} selected={selected} disabled={disabled} onSelect={onSelect} />
  }
  return <PluginCard item={item} Icon={Icon} selected={selected} disabled={disabled} onSelect={onSelect} />
}

// ---------------------------------------------------------------------------
// ThemeCard — large square-ish card with gradient preview at top
// ---------------------------------------------------------------------------

function ThemeCard({ item, selected, disabled, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled && !selected}
      className={cn(
        'group relative w-full text-left rounded-xl border transition-all overflow-hidden',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900',
        selected
          ? 'border-indigo-500 dark:border-indigo-400 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/30'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md',
        disabled && !selected && 'opacity-50 cursor-not-allowed',
      )}
    >
      {/* Gradient preview swatch */}
      <div className={cn('relative h-24 bg-gradient-to-br', item.color || 'from-slate-500 to-slate-700')}>
        {/* Faux screenshot content */}
        <div className="absolute inset-x-3 top-3 h-2 rounded bg-white/20" />
        <div className="absolute inset-x-3 top-7 h-1.5 rounded bg-white/15 w-2/3" />
        <div className="absolute inset-x-3 top-10 h-1.5 rounded bg-white/15 w-1/2" />
        <div className="absolute inset-x-3 bottom-3 flex gap-1.5">
          <div className="h-6 flex-1 rounded bg-white/15" />
          <div className="h-6 flex-1 rounded bg-white/15" />
        </div>
        {selected && (
          <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-white flex items-center justify-center shadow-md">
            <Check className="h-3.5 w-3.5 text-indigo-600" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-1.5 bg-white dark:bg-slate-900">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {item.name}
            </p>
            <p className="text-2xs text-slate-500 dark:text-slate-400 truncate">
              v{item.version} · {item.author}
            </p>
          </div>
        </div>
        <StarRating value={item.rating} count={item.numRatings} />
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// PluginCard — horizontal row with icon, name, meta, checkbox
// ---------------------------------------------------------------------------

function PluginCard({ item, Icon, selected, disabled, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled && !selected}
      className={cn(
        'group relative w-full text-left rounded-lg border p-3 transition-all flex items-start gap-3',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900',
        selected
          ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/10 ring-1 ring-indigo-500/30'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900 hover:shadow-sm',
        disabled && !selected && 'opacity-50 cursor-not-allowed',
      )}
    >
      {/* Checkbox */}
      <div
        className={cn(
          'shrink-0 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors mt-0.5',
          selected
            ? 'bg-indigo-600 border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500'
            : 'border-slate-300 dark:border-slate-600 group-hover:border-slate-400 dark:group-hover:border-slate-500',
        )}
      >
        {selected && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
      </div>

      {/* Icon */}
      <div
        className={cn(
          'shrink-0 h-9 w-9 rounded-lg flex items-center justify-center',
          selected
            ? 'bg-white dark:bg-slate-800'
            : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800',
        )}
      >
        {Icon && <Icon className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {item.name}
          </p>
          {selected && (
            <span className="shrink-0 text-2xs font-medium uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Selected
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
          {item.shortDescription}
        </p>
        <div className="flex items-center gap-3 pt-0.5">
          <StarRating value={item.rating} count={item.numRatings} />
          {item.activeInstalls ? (
            <span className="text-2xs text-slate-500 dark:text-slate-400 tabular-nums">
              {formatInstalls(item.activeInstalls)} installs
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// EmptyState — shown when search yields no results
// ---------------------------------------------------------------------------

export function CatalogEmpty({ message = 'No matches. Try a different search.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Package className="h-5 w-5 text-slate-400" />
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SelectedChip — compact pill for showing what's already selected (plugins)
// ---------------------------------------------------------------------------

export function SelectedChip({ item, onRemove }) {
  const Icon = item.source === 'custom' ? Plus : getIcon(item.icon)
  return (
    <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-500/30 text-xs font-medium">
      <Icon className="h-3.5 w-3.5" />
      <span className="max-w-[140px] truncate">{item.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 -mr-1 inline-flex items-center justify-center w-4 h-4 rounded hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors"
          aria-label={`Remove ${item.name}`}
        >
          ×
        </button>
      )}
    </span>
  )
}
