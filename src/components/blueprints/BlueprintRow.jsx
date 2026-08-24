'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getThemeBySlug } from '@/data/wpCatalog'

// ---------------------------------------------------------------------------
// BlueprintRow — minimal list row. Just the name, the theme name as a small
// subtitle, and a kebab menu with Duplicate / Delete. Click the row to edit.
//
// Everything else (description, plugin count, settings chips, usage badge,
// theme color dot) lives in the editor view. The list should be scannable
// without needing to read every row in detail — Linear issues, GitHub repos,
// Notion pages all follow this pattern.
//
// Props:
//   blueprint   — Blueprint object
//   onEdit      — () => void
//   onDuplicate — () => void
//   onDelete    — () => void
// ---------------------------------------------------------------------------

export function BlueprintRow({ blueprint, onEdit, onDuplicate, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onEsc = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [menuOpen])

  const theme = blueprint.theme?.source === 'directory'
    ? getThemeBySlug(blueprint.theme.slug)
    : null
  const themeName = blueprint.theme?.name || 'No theme'

  return (
    <div
      onClick={onEdit}
      className={cn(
        'group flex items-center gap-3 px-5 py-3.5',
        'cursor-pointer transition-colors',
        'hover:bg-slate-50 dark:hover:bg-slate-800/50',
      )}
    >
      {/* Primary: name + theme subtitle */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate" title={blueprint.name}>
          {blueprint.name}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {themeName}
        </p>
      </div>

      {/* Actions menu — only Duplicate and Delete live here */}
      <div ref={menuRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Blueprint actions"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1 z-20">
            <MenuItem icon={Copy} label="Duplicate" onClick={() => { setMenuOpen(false); onDuplicate?.() }} />
            <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
            <MenuItem icon={Trash2} label="Delete" destructive onClick={() => { setMenuOpen(false); onDelete?.() }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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