'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus, Search, Keyboard,
  Layers, Sparkles, Calendar, ArrowDownAZ,
  Trash2, Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  PageContainer, PageHeader, LoadingState,
} from '@/components/ui/page'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatRow } from '@/components/primitives/StatRow'
import { showToast } from '@/utils/toast-utils'
import { cn } from '@/lib/utils'
import { useBlueprintsStore } from '@/stores/blueprintsStore'
import { BlueprintCard } from '@/components/blueprints/BlueprintCard'

const SORT_OPTIONS = [
  { id: 'recent',  label: 'Recently updated', icon: Calendar },
  { id: 'name',    label: 'Name (A→Z)',       icon: ArrowDownAZ },
  { id: 'used',    label: 'Most used',        icon: Sparkles },
  { id: 'created', label: 'Recently created', icon: Calendar },
]

const FILTER_OPTIONS = [
  { id: 'all',    label: 'All' },
  { id: 'recent', label: 'Recent' },
  { id: 'used',   label: 'Popular' },
  { id: 'custom', label: 'Custom only' },
]

const KEYBOARD_HELP = [
  { key: 'n',     label: 'New blueprint' },
  { key: '/',     label: 'Focus search' },
  { key: '?',     label: 'Show keyboard shortcuts' },
  { key: 'Esc',   label: 'Close dialog' },
  { key: '↑↓',    label: 'Navigate cards (coming soon)' },
  { key: '⌘A',    label: 'Select all on this page' },
]

export default function BlueprintsPage() {
  const router = useRouter()
  const { blueprints, loading, load, remove, duplicate } = useBlueprintsStore()

  const [deleting, setDeleting] = useState(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('recent')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(new Set())
  const [showHelp, setShowHelp] = useState(false)
  const searchInputRef = useRef(null)

  // Track pending soft-delete operations so we can undo them
  const pendingDeletesRef = useRef(new Map()) // id -> { backup, timeoutId }

  useEffect(() => { load() }, [load])
  useEffect(() => { setSelected(new Set()) }, [search, sort, filter])

  // Cleanup pending deletes on unmount
  useEffect(() => () => {
    pendingDeletesRef.current.forEach((p) => clearTimeout(p.timeoutId))
  }, [])

  const stats = useMemo(() => {
    const total = blueprints.length
    const totalUsages = blueprints.reduce((sum, b) => sum + (b.usageCount || 0), 0)
    const mostUsed = blueprints.reduce((max, b) =>
      (b.usageCount || 0) > (max?.usageCount || 0) ? b : max, null)
    const now = Date.now()
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000
    const usedThisMonth = blueprints.filter((b) =>
      (b.usageCount || 0) > 0 && new Date(b.updatedAt).getTime() > monthAgo
    ).length
    return { total, totalUsages, mostUsed, usedThisMonth }
  }, [blueprints])

  const filtered = useMemo(() => {
    let list = blueprints
    if (filter === 'recent') {
      const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      list = list.filter((b) =>
        (b.usageCount || 0) > 0 && new Date(b.updatedAt).getTime() > monthAgo
      )
    } else if (filter === 'used') {
      list = list.filter((b) => (b.usageCount || 0) > 0)
    } else if (filter === 'custom') {
      list = list.filter((b) =>
        b.theme?.source === 'custom' ||
        (b.plugins || []).some((p) => p.source === 'custom')
      )
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((b) =>
        b.name.toLowerCase().includes(q) ||
        b.theme?.name?.toLowerCase().includes(q) ||
        b.plugins?.some((p) => p.name.toLowerCase().includes(q))
      )
    }
    const sorted = [...list]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'used') sorted.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    else if (sort === 'created') sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    else sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return sorted
  }, [blueprints, search, sort, filter])

  // Keyboard shortcuts — declared AFTER `filtered` so closure can capture the current list
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toUpperCase()
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) {
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault()
          if (filtered.length > 0) setSelected(new Set(filtered.map((b) => b.id)))
        }
        return
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        router.push('/blueprints/new')
      } else if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === '?') {
        e.preventDefault()
        setShowHelp((v) => !v)
      } else if (e.key === 'Escape') {
        setShowHelp(false)
        setDeleting(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, filtered])

  // ---- Soft delete with undo (5-second window) ----
  const cancelDelete = useCallback((id) => {
    const pending = pendingDeletesRef.current.get(id)
    if (!pending) return
    clearTimeout(pending.timeoutId)
    pendingDeletesRef.current.delete(id)
    // Restore blueprint to store
    useBlueprintsStore.setState((state) => {
      const exists = state.blueprints.some((b) => b.id === id)
      if (exists) return {}
      const restored = [pending.backup, ...state.blueprints]
      restored.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      return { blueprints: restored }
    })
    showToast.success('Restored', `"${pending.backup.name}" is back.`)
  }, [])

  const commitDelete = useCallback(async (id) => {
    const pending = pendingDeletesRef.current.get(id)
    pendingDeletesRef.current.delete(id)
    if (!pending) return
    try {
      await remove(id)
    } catch (err) {
      // Restore on failure
      useBlueprintsStore.setState((state) => ({
        blueprints: [pending.backup, ...state.blueprints],
      }))
      showToast.error('Delete failed', err?.message || 'Blueprint was restored')
    }
  }, [remove])

  const handleSoftDelete = (bp) => {
    const id = bp.id
    // Cancel any existing pending delete for this id
    const existing = pendingDeletesRef.current.get(id)
    if (existing) {
      clearTimeout(existing.timeoutId)
      pendingDeletesRef.current.delete(id)
    }

    const backup = JSON.parse(JSON.stringify(bp))
    // Optimistically remove from store
    useBlueprintsStore.setState((state) => ({
      blueprints: state.blueprints.filter((b) => b.id !== id),
    }))

    const timeoutId = setTimeout(() => commitDelete(id), 5000)
    pendingDeletesRef.current.set(id, { backup, timeoutId })

    const undoLabel = 'Undo'
    toast(`${bp.name} deleted`, {
      description: '5 seconds to undo',
      action: { label: undoLabel, onClick: () => cancelDelete(id) },
      duration: 5000,
      id: `delete-${id}`,
    })
  }

  const handleDelete = (bp) => setDeleting(bp)
  const handleDeleteConfirm = () => {
    const bp = deleting
    setDeleting(null)
    if (bp) handleSoftDelete(bp)
  }

  // ---- Bulk selection ----
  const allSelected = filtered.length > 0 && selected.size === filtered.length
  const someSelected = selected.size > 0
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set())
    else if (filtered.length > 0) setSelected(new Set(filtered.map((b) => b.id)))
  }
  const handleBulkDuplicate = async () => {
    const ids = Array.from(selected)
    for (const id of ids) {
      const bp = blueprints.find((b) => b.id === id)
      if (bp) {
        try { await duplicate(bp.id) } catch { /* swallow */ }
      }
    }
    setSelected(new Set())
    showToast.success(`Duplicated ${ids.length} blueprint${ids.length === 1 ? '' : 's'}`)
  }
  const handleBulkDelete = () => {
    const ids = Array.from(selected)
    const bps = ids.map((id) => blueprints.find((b) => b.id === id)).filter(Boolean)
    setSelected(new Set())
    bps.forEach((bp) => handleSoftDelete(bp))
  }

  const handleCreate = () => router.push('/blueprints/new')
  const handleEdit = (bp) => router.push(`/blueprints/${bp.id}/edit`)
  const handleDuplicate = async (bp) => {
    try {
      const copy = await duplicate(bp.id)
      showToast.success('Blueprint duplicated', `Created "${copy.name}".`)
    } catch (err) {
      showToast.error(err?.message || 'Failed to duplicate blueprint')
    }
  }

  return (
    <PageContainer size="lg">
      <PageHeader
        title="WP Blueprints"
        subtitle="Reusable WordPress site configurations."
      >
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create blueprint</span>
          <span className="sm:hidden">New</span>
        </Button>
      </PageHeader>

      {!loading && blueprints.length > 0 && (
        <div className="mb-6">
          <StatRow
            tiles={[
              { label: 'Total blueprints', value: stats.total, icon: Layers, tone: 'indigo', subline: stats.total === 1 ? 'blueprint saved' : 'blueprints saved' },
              { label: 'Used this month', value: stats.usedThisMonth, icon: Calendar, tone: 'emerald', subline: stats.usedThisMonth === 0 ? 'no recent uses' : 'blueprints in active use' },
              { label: 'Total site uses', value: stats.totalUsages, icon: Sparkles, tone: 'amber', subline: stats.totalUsages === 0 ? 'no sites yet' : 'sites created from blueprints' },
              { label: 'Most used', value: stats.mostUsed?.name || '—', icon: Sparkles, tone: 'violet', subline: stats.mostUsed ? `${stats.mostUsed.usageCount || 0} sites` : 'no data' },
            ]}
          />
        </div>
      )}

      {!loading && blueprints.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {FILTER_OPTIONS.map((f) => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'h-8 px-3 rounded-full text-xs font-medium border transition-colors',
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500 shadow-sm shadow-indigo-500/20'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                )}
                aria-pressed={active}
              >
                {f.label}
              </button>
            )
          })}
          {filter !== 'all' && (
            <span className="text-2xs text-slate-500 dark:text-slate-400 ml-1">
              {filtered.length} of {blueprints.length}
            </span>
          )}
        </div>
      )}

      {!loading && blueprints.length > 0 && (
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, theme, or plugin…  (press / to focus)"
              className="pl-9 pr-9 h-10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Clear search"
              >
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="hidden sm:inline-flex items-center h-9 pl-2.5 pr-3 gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs font-medium"
              title="Keyboard shortcuts (?)"
            >
              <span className="font-mono">?</span>
              <span>Shortcuts</span>
            </button>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="sm:hidden h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-4 w-4" />
            </button>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className={cn(
                  'h-10 pl-3 pr-9 rounded-lg border border-slate-200 dark:border-slate-700',
                  'bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200',
                  'appearance-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-600',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
                )}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {someSelected && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
          <span className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
            {selected.size} selected
          </span>
          <div className="flex-1" />
          <Button type="button" variant="outline" size="sm" onClick={handleBulkDuplicate} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleBulkDelete} className="gap-1.5 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10">
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading blueprints…" />
      ) : blueprints.length === 0 ? (
        <EmptyBlueprints onCreate={handleCreate} />
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No blueprints match "<span className="font-medium">{search}</span>".
          </p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSearch('')}>
            Clear search
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/40 cursor-pointer"
              aria-label="Select all blueprints"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {allSelected ? 'Deselect all' : `Select all (${filtered.length})`}
            </span>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((bp) => (
              <div key={bp.id} className="relative">
                <div className="absolute top-3 left-3 z-10">
                  <input
                    type="checkbox"
                    checked={selected.has(bp.id)}
                    onChange={() => toggleSelect(bp.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/40 cursor-pointer bg-white dark:bg-slate-900"
                    aria-label={`Select ${bp.name}`}
                  />
                </div>
                <BlueprintCard
                  blueprint={bp}
                  onEdit={() => handleEdit(bp)}
                  onDuplicate={() => handleDuplicate(bp)}
                  onDelete={() => handleDelete(bp)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete blueprint"
        description={deleting ? `"${deleting.name}" will be removed. Sites already created from this blueprint will keep their settings.` : ''}
        confirmText="Delete blueprint"
        variant="destructive"
        icon={<Trash2 className="h-4 w-4" />}
        onConfirm={handleDeleteConfirm}
      />

      <ConfirmDialog
        open={showHelp}
        onOpenChange={setShowHelp}
        title="Keyboard shortcuts"
        confirmText="Got it"
        cancelText=""
        icon={<Keyboard className="h-4 w-4" />}
        onConfirm={() => setShowHelp(false)}
      >
        <div className="space-y-2">
          {KEYBOARD_HELP.map((h) => (
            <div key={h.key} className="flex items-center gap-3 py-1">
              <kbd className="shrink-0 min-w-[2.5rem] h-7 px-2 inline-flex items-center justify-center text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded">
                {h.key}
              </kbd>
              <span className="text-sm text-slate-600 dark:text-slate-300">{h.label}</span>
            </div>
          ))}
          <p className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700 text-2xs text-slate-500 dark:text-slate-400">
            Shortcuts are disabled while typing in an input field.
          </p>
        </div>
      </ConfirmDialog>
    </PageContainer>
  )
}

function EmptyBlueprints({ onCreate }) {
  return (
    <Card className="border-dashed border-2 border-slate-300 dark:border-slate-700">
      <div className="px-6 py-16 text-center max-w-xl mx-auto">
        <div className="mx-auto h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-5">
          <Layers className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          No blueprints yet
        </h3>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          A blueprint is a saved WordPress configuration — a theme, a set of plugins, and key settings. When you create a new WordPress site, pick a blueprint to install everything in one step.
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Blueprints are independent — editing one doesn't affect the others, and you can duplicate any blueprint to start a new variant.
        </p>
        <Button onClick={onCreate} size="lg" className="mt-6 gap-2">
          <Plus className="h-4 w-4" />
          Create your first blueprint
        </Button>
      </div>
    </Card>
  )
}
