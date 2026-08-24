'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, Copy, Trash2, Plus, Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getThemeBySlug } from '@/data/wpCatalog'
import { ThemePreview, getThemeScreenshotUrl } from './ThemePreview'

// ---------------------------------------------------------------------------
// BlueprintCard — list page card. Shows the default theme's design preview,
// plus all the metadata a user needs to identify the blueprint without
// clicking in: name, description, theme, theme count, plugin count,
// author/version of the default theme.
//
// Props:
//   blueprint   — Blueprint object
//   onEdit      — () => void
//   onDuplicate — () => void
//   onDelete    — () => void
// ---------------------------------------------------------------------------

export function BlueprintCard({ blueprint, onEdit, onDuplicate, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  // Open the kebab menu and compute its anchored position from the button's
  // bounding rect. Because the kebab menu is rendered into document.body via
  // createPortal below, the Card's overflow-hidden no longer clips it.
  const openMenu = () => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 4, // 4px gap (mt-1 equivalent)
      right: Math.max(8, window.innerWidth - rect.right),
    })
    setMenuOpen(true)
  }

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e) => {
      const btn = buttonRef.current
      const menu = menuRef.current
      // Click on the kebab button = ignore (toggle handler takes care of it).
      // Click inside the portaled menu = ignore (menu handles its own actions).
      // Anything else = close.
      if (btn && btn.contains(e.target)) return
      if (menu && menu.contains(e.target)) return
      setMenuOpen(false)
    }
    const onEsc = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [menuOpen])

  // Get the default theme + count of additional themes
  const themes = Array.isArray(blueprint.themes) ? blueprint.themes
    : (blueprint.theme ? [{ ...blueprint.theme, isDefault: true }] : [])
  const defaultTheme = themes.find((t) => t.isDefault) || themes[0]
  const additionalThemesCount = Math.max(0, themes.length - 1)

  const defaultThemeMeta = defaultTheme?.source === 'directory' ? getThemeBySlug(defaultTheme.slug) : null
  const defaultThemeColor = defaultThemeMeta?.color
    || (defaultTheme?.source === 'custom' ? 'from-indigo-600 to-purple-700' : 'from-slate-500 to-slate-700')

  const pluginCount = blueprint.plugins?.length || 0

  return (
    <Card
      interactive
      elevated
      onClick={onEdit}
      className={cn(
        'group relative cursor-pointer p-0',
        'hover:shadow-lg hover:-translate-y-0.5',
        'transition-all duration-200',
        'border-slate-200 dark:border-slate-800',
      )}
    >
      {/* Theme preview */}
      <ThemePreview
        screenshotUrl={defaultTheme?.source === 'directory' ? getThemeScreenshotUrl(defaultTheme.slug) : null}
        themeColor={defaultThemeColor}
        themeName={defaultTheme?.name || 'No theme'}
      />

      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={blueprint.name}>
              {blueprint.name}
            </h3>
            {blueprint.description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2" title={blueprint.description}>
                {blueprint.description}
              </p>
            )}
          </div>

          {/* Kebab menu — render into document.body via createPortal so the
              dropdown escapes the Card's overflow-hidden (Card bakes that in
              for its rounded-corner screenshot clipping). */}
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              ref={buttonRef}
              type="button"
              onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Blueprint actions"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && menuPos && createPortal(
              <div
                ref={menuRef}
                style={{
                  position: 'fixed',
                  top: menuPos.top,
                  right: menuPos.right,
                  width: '11rem',
                }}
                className="z-50 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1"
              >
                <MenuItem icon={Copy} label="Duplicate" onClick={() => { setMenuOpen(false); onDuplicate?.() }} />
                <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                <MenuItem icon={Trash2} label="Delete" destructive onClick={() => { setMenuOpen(false); onDelete?.() }} />
              </div>,
              document.body
            )}
          </div>
        </div>

        {/* Theme metadata: name + author (linked to authorUrl) + version */}
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          <Star className="h-3 w-3 text-indigo-500 fill-indigo-500 shrink-0" />
          <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
            {defaultTheme?.name || 'No theme'}
          </span>
          {defaultThemeMeta && (
            <>
              <span className="text-slate-300 dark:text-slate-600 shrink-0">·</span>
              {defaultThemeMeta.authorUrl ? (
                <a
                  href={defaultThemeMeta.authorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 truncate max-w-[140px] shrink"
                  title={defaultThemeMeta.authorUrl}
                >
                  {defaultThemeMeta.author}
                </a>
              ) : (
                <span className="text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                  {defaultThemeMeta.author}
                </span>
              )}
              <span className="text-slate-300 dark:text-slate-600 shrink-0">·</span>
              <span className="text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                v{defaultThemeMeta.version}
              </span>
            </>
          )}
        </div>

        {/* Pills: rating (if any) · requires WP · child of (parent theme) */}
        {(defaultThemeMeta?.rating > 0 ||
          defaultThemeMeta?.requires ||
          defaultThemeMeta?.parent) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {defaultThemeMeta?.rating > 0 && (
              <span
                className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-2xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25"
                title={`${defaultThemeMeta.numRatings?.toLocaleString() || 0} reviews on WordPress.org`}
              >
                <Star className="h-3 w-3 fill-current" />
                {defaultThemeMeta.rating.toFixed(1)}
                {defaultThemeMeta.numRatings > 0 && (
                  <span className="text-amber-600/70 dark:text-amber-400/70 tabular-nums">
                    ({defaultThemeMeta.numRatings.toLocaleString()})
                  </span>
                )}
              </span>
            )}
            {defaultThemeMeta?.requires && (
              <span
                className="inline-flex items-center h-5 px-1.5 rounded text-2xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                title={`Requires at least WordPress ${defaultThemeMeta.requires}`}
              >
                WP {defaultThemeMeta.requires}+
              </span>
            )}
            {defaultThemeMeta?.parent && (
              <span
                className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-2xs font-medium bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 border border-violet-200/60 dark:border-violet-500/25"
                title={`This is a child theme — it requires ${defaultThemeMeta.parent.name} to be installed`}
              >
                ↳ Child of {defaultThemeMeta.parent.name}
              </span>
            )}
          </div>
        )}

        {/* Counts: +N themes, N plugins */}
        {(additionalThemesCount > 0 || pluginCount > 0) && (
          <div className="flex items-center gap-3 pt-0.5">
            {additionalThemesCount > 0 && (
              <span className="inline-flex items-center gap-1 text-2xs text-slate-500 dark:text-slate-400">
                <Plus className="h-3 w-3" />
                {additionalThemesCount} more theme{additionalThemesCount === 1 ? '' : 's'}
              </span>
            )}
            {pluginCount > 0 && (
              <span className="inline-flex items-center gap-1 text-2xs text-slate-500 dark:text-slate-400">
                {pluginCount} plugin{pluginCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function MenuItem({ icon: Icon, label, onClick, destructive }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors',
        destructive
          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}