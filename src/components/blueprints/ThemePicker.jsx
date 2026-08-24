'use client'

import { useState, useMemo } from 'react'
import { Search, Link as LinkIcon, Globe, Star, X, Plus, Check, Eye, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CatalogItemCard, CatalogEmpty } from './CatalogItemCard'
import { ThemePreview, getThemeScreenshotUrl } from './ThemePreview'
import { WP_THEMES, getThemeBySlug } from '@/data/wpCatalog'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// ThemePicker — multi-select with one default. User can add as many themes
// as they want (from directory or custom URL), and mark exactly one as the
// default (the one that gets activated when the site is created).
//
// Props:
//   value       — array of { source, slug, name, url?, isDefault }
//   onChange    — (next) => void
// ---------------------------------------------------------------------------

export function ThemePicker({ value = [], onChange }) {
  const [tab, setTab] = useState(value.some((t) => t.source === 'custom') ? 'custom' : 'directory')
  const [query, setQuery] = useState('')

  const slugs = new Set(value.map((t) => t.slug))

  const setDefault = (slug) => onChange(value.map((t) => ({ ...t, isDefault: t.slug === slug })))
  const remove = (slug) => {
    const next = value.filter((t) => t.slug !== slug)
    // If we removed the default, make the first remaining theme the default
    if (next.length > 0 && !next.some((t) => t.isDefault)) {
      next[0] = { ...next[0], isDefault: true }
    }
    onChange(next)
  }
  const addFromDirectory = (theme) => {
    const isFirst = value.length === 0
    onChange([...value, { source: 'directory', slug: theme.slug, name: theme.name, isDefault: isFirst }])
  }
  const addCustom = ({ name, url }) => {
    const slug = `custom_${Date.now().toString(36)}`
    const isFirst = value.length === 0
    onChange([...value, { source: 'custom', slug, name: name.trim(), url: url.trim(), isDefault: isFirst }])
  }

  return (
    <div className="space-y-5">
      {/* Selected themes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Selected themes · <span className="text-indigo-600 dark:text-indigo-400">{value.length}</span>
          </p>
          {value.length > 1 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {value.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="h-9 w-9 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <Globe className="h-4 w-4 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No themes selected. Add one below — the first becomes the default.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {value.map((theme) => {
              const themeMeta = theme.source === 'directory' ? getThemeBySlug(theme.slug) : null
              const color = themeMeta?.color || (theme.source === 'custom' ? 'from-indigo-600 to-purple-700' : 'from-slate-500 to-slate-700')
              return (
                <div
                  key={theme.slug}
                  className={cn(
                    'flex items-center gap-3 p-2.5 rounded-xl border transition-colors',
                    theme.isDefault
                      ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/10 ring-1 ring-indigo-500/30'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
                  )}
                >
                  {/* Theme preview */}
                  <div className="shrink-0 w-20 aspect-[4/3] overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                    <ThemePreview
                      screenshotUrl={getThemeScreenshotUrl(theme.slug)}
                      themeColor={color}
                      themeName={theme.name}
                      className="h-full"
                      showBadge={false}
                    />
                  </div>

                  {/* Theme info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{theme.name}</p>
                      {theme.isDefault && (
                        <span className="shrink-0 inline-flex items-center gap-0.5 h-5 px-1.5 rounded text-2xs font-medium bg-indigo-600 text-white">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          Default
                        </span>
                      )}
                      {themeMeta?.requires && (
                        <span className="shrink-0 inline-flex items-center h-5 px-1.5 rounded text-2xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          WP {themeMeta.requires}+
                        </span>
                      )}
                      {themeMeta?.parent && (
                        <span
                          className="shrink-0 inline-flex items-center h-5 px-1.5 rounded text-2xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 border border-violet-200/60 dark:border-violet-500/25"
                          title={`Child theme — requires ${themeMeta.parent.name}`}
                        >
                          ↳ {themeMeta.parent.name}
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {theme.source === 'custom'
                        ? theme.url
                        : (themeMeta?.author ? (
                            <>
                              {themeMeta.authorUrl ? (
                                <a
                                  href={themeMeta.authorUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                                >
                                  {themeMeta.author}
                                </a>
                              ) : themeMeta.author}
                              {' · v' + themeMeta.version}
                            </>
                          ) : 'WordPress')}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!theme.isDefault && (
                      <button
                        type="button"
                        onClick={() => setDefault(theme.slug)}
                        className="h-7 px-2 rounded-md flex items-center gap-1 text-xs text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                        title="Set as default"
                        aria-label={`Set ${theme.name} as default`}
                      >
                        <Star className="h-3.5 w-3.5" />
                        <span>Set default</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(theme.slug)}
                      className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Remove"
                      aria-label={`Remove ${theme.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add theme */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
          Add theme
        </p>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="directory" className="flex-1 sm:flex-none gap-2">
              <Globe className="h-3.5 w-3.5" />
              From directory
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex-1 sm:flex-none gap-2">
              <LinkIcon className="h-3.5 w-3.5" />
              Custom theme
            </TabsTrigger>
          </TabsList>

          <TabsContent value="directory" className="mt-3">
            <DirectoryAdd
              query={query}
              setQuery={setQuery}
              slugs={slugs}
              onAdd={addFromDirectory}
            />
          </TabsContent>

          <TabsContent value="custom" className="mt-3">
            <CustomAdd onAdd={addCustom} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Directory add — searchable grid of themes not already selected
// ---------------------------------------------------------------------------

function DirectoryAdd({ query, setQuery, slugs, onAdd }) {
  const [previewSlug, setPreviewSlug] = useState(null)
  const previewTheme = previewSlug ? getThemeBySlug(previewSlug) : null

  const filtered = useMemo(() => {
    let list = WP_THEMES.filter((t) => !slugs.has(t.slug))
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.author.toLowerCase().includes(q) ||
        t.shortDescription.toLowerCase().includes(q)
      )
    }
    return list
  }, [query, slugs])

  // Theme preview lightbox — large screenshot + full metadata + Add to blueprint
  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search themes…"
          className="pl-9 h-10"
        />
      </div>

      {value_count_label(filtered.length, slugs.size)}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="col-span-full">
            <CatalogEmpty message={slugs.size > 0 ? 'All themes already added.' : `No themes match "${query}".`} />
          </div>
        ) : (
          filtered.map((theme) => (
            <button
              key={theme.slug}
              type="button"
              onClick={() => onAdd(theme)}
              className="group relative w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-400 hover:shadow-md transition-all overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              <ThemePreview screenshotUrl={getThemeScreenshotUrl(theme.slug)} themeColor={theme.color} themeName={theme.name} />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPreviewSlug(theme.slug) }}
                className="absolute top-2 right-2 h-7 w-7 rounded-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm flex items-center justify-center text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label={`Preview ${theme.name}`}
                title="Preview details"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
              <div className="p-3 space-y-1.5">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{theme.name}</p>
                <p className="text-2xs text-slate-500 dark:text-slate-400 truncate">v{theme.version} · {theme.author}</p>
                {(theme.rating > 0 || theme.requires || theme.parent) && (
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {theme.rating > 0 && (
                      <span
                        className="inline-flex items-center gap-1 h-4 px-1 rounded text-2xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25"
                        title={`${(theme.numRatings || 0).toLocaleString()} reviews`}
                      >
                        <Star className="h-2.5 w-2.5 fill-current" />
                        {theme.rating.toFixed(1)}
                      </span>
                    )}
                    {theme.requires && (
                      <span
                        className="inline-flex items-center h-4 px-1 rounded text-2xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        title={`Requires WordPress ${theme.requires}+`}
                      >
                        WP {theme.requires}+
                      </span>
                    )}
                    {theme.parent && (
                      <span
                        className="inline-flex items-center gap-0.5 h-4 px-1 rounded text-2xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 border border-violet-200/60 dark:border-violet-500/25"
                        title={`Child theme — requires ${theme.parent.name}`}
                      >
                        ↳ {theme.parent.name}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <p className="text-2xs text-slate-500 dark:text-slate-400">
        Showing {filtered.length} of {WP_THEMES.length} themes. In production this list comes from api.wordpress.org/themes.
      </p>

      <Dialog open={!!previewSlug} onOpenChange={(open) => !open && setPreviewSlug(null)}>
        {previewTheme && (
          <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
            <div className="relative">
              <ThemePreview
                screenshotUrl={getThemeScreenshotUrl(previewTheme.slug)}
                themeColor={previewTheme.color}
                themeName={previewTheme.name}
                className="h-56 rounded-none"
                showBadge={false}
              />
              <button
                type="button"
                onClick={() => setPreviewSlug(null)}
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-lg">{previewTheme.name}</DialogTitle>
                <DialogDescription>
                  Preview details for {previewTheme.name}. Click "Add to blueprint" to include it, or close to browse more.
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {previewTheme.author}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 dark:text-slate-400 tabular-nums">v{previewTheme.version}</span>
                {previewTheme.rating > 0 && (
                  <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-2xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25">
                    <Star className="h-3 w-3 fill-current" />
                    {previewTheme.rating.toFixed(1)}
                    {previewTheme.numRatings > 0 && (
                      <span className="text-amber-600/70 dark:text-amber-400/70 tabular-nums">
                        ({previewTheme.numRatings.toLocaleString()})
                      </span>
                    )}
                  </span>
                )}
                {previewTheme.requires && (
                  <span className="inline-flex items-center h-5 px-1.5 rounded text-2xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    WP {previewTheme.requires}+
                  </span>
                )}
                {previewTheme.parent && (
                  <span className="inline-flex items-center h-5 px-1.5 rounded text-2xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 border border-violet-200/60 dark:border-violet-500/25">
                    ↳ Child of {previewTheme.parent.name}
                  </span>
                )}
              </div>

              {previewTheme.description && (
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {previewTheme.description}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                {previewTheme.homepage ? (
                  <a
                    href={previewTheme.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View on WordPress.org
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : <span />}
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setPreviewSlug(null)}>
                    Close
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (slugs.has(previewTheme.slug)) return
                      onAdd(previewTheme)
                      setPreviewSlug(null)
                    }}
                    disabled={slugs.has(previewTheme.slug)}
                  >
                    {slugs.has(previewTheme.slug) ? 'Already in blueprint' : 'Add to blueprint'}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}

function value_count_label(filteredCount, selectedCount) {
  return (
    <p className="text-2xs text-slate-500 dark:text-slate-400">
      {filteredCount} theme{filteredCount === 1 ? '' : 's'} available
      {selectedCount > 0 ? ` · ${selectedCount} already added` : ''}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Custom add — URL + display name form
// ---------------------------------------------------------------------------

function CustomAdd({ onAdd }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const isValid = url.trim().length > 0 && name.trim().length > 0

  const apply = () => {
    if (!isValid) return
    onAdd({ name, url })
    setUrl('')
    setName('')
  }

  return (
    <div className="space-y-3 max-w-xl">
      <div className="space-y-1.5">
        <Label htmlFor="custom-theme-name" className="text-sm">Theme name</Label>
        <Input
          id="custom-theme-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My custom theme"
          className="h-10"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="custom-theme-url" className="text-sm">Download URL</Label>
        <Input
          id="custom-theme-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/my-theme.zip"
          className="h-10"
        />
        <p className="text-2xs text-slate-500 dark:text-slate-400">
          Direct link to a .zip archive.
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={apply} disabled={!isValid} className="gap-2">
          <Check className="h-4 w-4" />
          Add custom theme
        </Button>
      </div>
    </div>
  )
}
