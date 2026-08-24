'use client'

import { useState, useMemo } from 'react'
import { Search, Link as LinkIcon, Puzzle, X, Star } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CatalogItemCard, SelectedChip, CatalogEmpty } from './CatalogItemCard'
import { WP_PLUGINS, PLUGIN_CATEGORIES, getPluginBySlug } from '@/data/wpCatalog'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// PluginPicker — multi-select plugins for a blueprint. User can add as many
// as they want, and mark exactly one as the default (the primary plugin).
//
// Props:
//   value       — array of { source, slug, name, url?, enabled, isDefault }
//   onChange    — (next) => void
// ---------------------------------------------------------------------------

export function PluginPicker({ value = [], onChange }) {
  // Tab is local state — user can freely switch between directory and custom
  const [tab, setTab] = useState(value.some((p) => p.source === 'custom') ? 'custom' : 'directory')

  const remove = (slug) => {
    const next = value.filter((p) => p.slug !== slug)
    if (next.length > 0 && !next.some((p) => p.isDefault)) {
      next[0] = { ...next[0], isDefault: true }
    }
    onChange(next)
  }
  const setDefault = (slug) => {
    onChange(value.map((p) => ({ ...p, isDefault: p.slug === slug })))
  }
  const clearAll = () => onChange([])

  return (
    <div className="space-y-4">
      <SelectedRow value={value} onRemove={remove} onClear={clearAll} setDefault={setDefault} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="directory" className="flex-1 sm:flex-none gap-2">
            <Puzzle className="h-3.5 w-3.5" />
            From directory
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex-1 sm:flex-none gap-2">
            <LinkIcon className="h-3.5 w-3.5" />
            Custom plugins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="mt-4">
          <DirectoryTab value={value} onChange={onChange} />
        </TabsContent>

        <TabsContent value="custom" className="mt-4">
          <CustomTab value={value} onChange={onChange} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Selected row — count + chips with set-default + remove
// ---------------------------------------------------------------------------

function SelectedRow({ value, onRemove, onClear, setDefault }) {
  if (value.length === 0) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="h-9 w-9 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <Puzzle className="h-4 w-4 text-slate-400" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No plugins selected. Sites using this blueprint will start with WordPress core only.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Selected · <span className="text-indigo-600 dark:text-indigo-400">{value.length}</span>
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((p) => (
          <SelectedPluginChip
            key={p.slug}
            plugin={p}
            onRemove={() => onRemove(p.slug)}
            onSetDefault={() => setDefault(p.slug)}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Selected plugin chip — with set-default + remove
// ---------------------------------------------------------------------------

function SelectedPluginChip({ plugin, onRemove, onSetDefault }) {
  const Icon = plugin.source === 'custom' ? LinkIcon : (() => {
    const meta = getPluginBySlug(plugin.slug)
    if (!meta?.icon) return Puzzle
    // dynamic icon resolution handled by CatalogItemCard's getIcon logic
    return Puzzle
  })()

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-full border text-xs font-medium',
        plugin.isDefault
          ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700',
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="max-w-[140px] truncate">{plugin.name}</span>
      {plugin.isDefault && (
        <span className="inline-flex items-center gap-0.5 text-2xs font-semibold uppercase tracking-wide ml-0.5">
          <Star className="h-2.5 w-2.5 fill-current" />
          Default
        </span>
      )}
      {!plugin.isDefault && (
        <button
          type="button"
          onClick={onSetDefault}
          className="ml-0.5 inline-flex items-center gap-0.5 px-1.5 h-5 rounded text-2xs text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
          aria-label={`Set ${plugin.name} as default`}
          title="Set as default"
        >
          <Star className="h-2.5 w-2.5" />
          <span>Default</span>
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 -mr-0.5 inline-flex items-center justify-center w-4 h-4 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        aria-label={`Remove ${plugin.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Directory tab — search + category filter + grid of checkable plugin cards
// ---------------------------------------------------------------------------

function DirectoryTab({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  const selectedSlugs = new Set(value.filter((p) => p.source === 'directory').map((p) => p.slug))
  const selectedCount = selectedSlugs.size

  const filtered = useMemo(() => {
    let list = WP_PLUGINS
    if (category !== 'all') list = list.filter((p) => p.category === category)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q)
      )
    }
    return list
  }, [query, category])

  const toggle = (plugin) => {
    if (selectedSlugs.has(plugin.slug)) {
      const next = value.filter((p) => p.slug !== plugin.slug)
      if (next.length > 0 && !next.some((p) => p.isDefault)) {
        next[0] = { ...next[0], isDefault: true }
      }
      onChange(next)
    } else {
      const isFirst = value.length === 0
      onChange([...value, { source: 'directory', slug: plugin.slug, name: plugin.name, enabled: true, isDefault: isFirst }])
    }
  }
  const setDefault = (slug) => {
    onChange(value.map((p) => ({ ...p, isDefault: p.slug === slug })))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plugins…"
            className="pl-9 h-10"
          />
        </div>
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {selectedCount} selected
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PLUGIN_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={
              'h-7 px-2.5 rounded-full text-xs font-medium border transition-colors ' +
              (category === c.id
                ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500 shadow-sm shadow-indigo-500/20'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600')
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="col-span-full">
            <CatalogEmpty message={`No plugins match "${query}".`} />
          </div>
        ) : (
          filtered.map((plugin) => {
            const isSelected = selectedSlugs.has(plugin.slug)
            const isDefault = value.find((p) => p.slug === plugin.slug)?.isDefault
            return (
              <div key={plugin.slug} className="relative">
                <CatalogItemCard
                  item={plugin}
                  mode="plugin"
                  selected={isSelected}
                  onSelect={() => toggle(plugin)}
                />
                {isSelected && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDefault(plugin.slug) }}
                    className={cn(
                      'absolute top-2 right-2 h-7 w-7 rounded-md flex items-center justify-center transition-colors',
                      isDefault
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        : 'bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10',
                    )}
                    title={isDefault ? 'Default plugin' : 'Set as default'}
                    aria-label={isDefault ? `${plugin.name} is the default plugin` : `Set ${plugin.name} as default`}
                  >
                    <Star className={cn('h-3.5 w-3.5', isDefault && 'fill-current')} />
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>

      <p className="text-2xs text-slate-500 dark:text-slate-400">
        Showing {filtered.length} of {WP_PLUGINS.length} plugins. In production this list comes from api.wordpress.org/plugins.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom tab — add multiple custom plugins by URL
// ---------------------------------------------------------------------------

function CustomTab({ value, onChange }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')

  const customPlugins = value.filter((p) => p.source === 'custom')
  const isValid = url.trim().length > 0 && name.trim().length > 0
  const wouldDuplicate = value.some((p) => p.slug === url.trim() || p.name === name.trim())

  const add = () => {
    if (!isValid || wouldDuplicate) return
    const slug = `custom_${Date.now().toString(36)}`
    const isFirst = value.length === 0
    onChange([
      ...value,
      { source: 'custom', slug, url: url.trim(), name: name.trim(), enabled: true, isDefault: isFirst },
    ])
    setUrl('')
    setName('')
  }

  const remove = (slug) => {
    const next = value.filter((p) => p.slug !== slug)
    if (next.length > 0 && !next.some((p) => p.isDefault)) {
      next[0] = { ...next[0], isDefault: true }
    }
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-1 space-y-1.5">
            <Label htmlFor="custom-plugin-name" className="text-sm">Plugin name</Label>
            <Input
              id="custom-plugin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My plugin"
              className="h-10"
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="custom-plugin-url" className="text-sm">Download URL</Label>
            <Input
              id="custom-plugin-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/my-plugin.zip"
              className="h-10"
            />
          </div>
        </div>
        {wouldDuplicate && (
          <p className="text-xs text-amber-700 dark:text-amber-300">A plugin with this name or URL already exists.</p>
        )}
        <div className="flex justify-end">
          <Button type="button" onClick={add} disabled={!isValid || wouldDuplicate}>
            Add custom plugin
          </Button>
        </div>
      </div>

      {customPlugins.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Custom plugins · <span className="text-indigo-600 dark:text-indigo-400">{customPlugins.length}</span>
          </p>
          <div className="space-y-1.5">
            {customPlugins.map((p) => (
              <div
                key={p.slug}
                className={cn(
                  'flex items-center gap-3 p-2.5 rounded-lg border bg-white dark:bg-slate-900',
                  p.isDefault
                    ? 'border-indigo-300 dark:border-indigo-500/40 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700',
                )}
              >
                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <LinkIcon className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.name}</p>
                    {p.isDefault && (
                      <span className="shrink-0 inline-flex items-center gap-0.5 h-4 px-1 rounded text-2xs font-semibold uppercase tracking-wider bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(p.slug)}
                  className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  aria-label={`Remove ${p.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}