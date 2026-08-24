'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Save, X, Layers, Info, Palette, Puzzle, Settings,
  CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { PageContainer, PageBreadcrumb } from '@/components/ui/page'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { showToast } from '@/utils/toast-utils'
import { ThemePicker } from './ThemePicker'
import { PluginPicker } from './PluginPicker'
import { BlueprintSettingsForm } from './BlueprintSettingsForm'
import { DEFAULT_BLUEPRINT_SETTINGS } from '@/data/wpCatalog'

// ---------------------------------------------------------------------------
// BlueprintEditor — full-page editor at /blueprints/new and
// /blueprints/[id]/edit.
//
// Structure (top to bottom):
//   1. Sticky header  — title, "X changes pending" badge, Cancel + Save buttons,
//                       Cmd+S hint
//   2. Basics         — blueprint name (with inline description + completion pill)
//   3. Setup          — themes (multi-select, default) + plugins (multi-select, default)
//   4. WordPress      — General sub-card (locale + permalink)
//                        Advanced sub-card (privacy + debug, marked Advanced,
//                        collapse by default)
//   5. Bottom save bar — primary save action + keyboard hint
//
// Each section header shows a status pill:
//   ✓ Complete (green) — section is fully configured
//   ⚠ Needs setup (amber) — section is missing required fields
//
// Inline field descriptions under every control so the user knows what each
// option does. Inline validation on save + count of unsaved sub-sections on
// the save bar.
//
// Keyboard:
//   Cmd+S / Ctrl+S — save
//   Esc (when dirty) — opens discard-confirmation
//
// Props:
//   initial     — existing Blueprint (edit mode) or null (create mode)
//   onSave      — async (payload) => void
//   breadcrumbs — array of { label, href? }
// ---------------------------------------------------------------------------

const WP_GENERAL_SECTIONS = ['locale', 'permalink']
const WP_ADVANCED_SECTIONS = ['privacy', 'debug']

function normalizeThemes(input) {
  if (Array.isArray(input?.themes) && input.themes.length > 0) return input.themes
  if (input?.theme) return [{ ...input.theme, isDefault: true }]
  return []
}

export function BlueprintEditor({ initial, onSave, breadcrumbs }) {
  const router = useRouter()
  const isEdit = !!initial

  const [name, setName] = useState(initial?.name || '')
  const [themes, setThemes] = useState(() => {
    const t = normalizeThemes(initial)
    return t.length > 0 ? t : [{ source: 'directory', slug: 'twentytwentyfour', name: 'Twenty Twenty-Four', isDefault: true }]
  })
  const [plugins, setPlugins] = useState(initial?.plugins || [])
  const [settings, setSettings] = useState({ ...DEFAULT_BLUEPRINT_SETTINGS, ...(initial?.settings || {}) })
  const [submitting, setSubmitting] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [errors, setErrors] = useState({})
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Baseline — used to compute dirty state and a count of "sub-section changes"
  const [baseline, setBaseline] = useState(() =>
    serialize({ name, themes, plugins, settings }))
  useEffect(() => {
    if (isEdit) {
      const t = normalizeThemes(initial)
      setBaseline(serialize({
        name: initial.name, themes: t, plugins: initial.plugins, settings: initial.settings,
      }))
    }
  }, [initial, isEdit])

  const current = serialize({ name, themes, plugins, settings })
  const isDirty = current !== baseline

  // Per-section dirtiness — used on the save bar
  const dirtySections = useMemo(() => {
    const base = JSON.parse(baseline)
    const dirty = []
    if (serialize({ name: base.name }) !== serialize({ name })) dirty.push('basics')
    if (serialize({ themes: base.themes }) !== serialize({ themes })) dirty.push('setup')
    if (serialize({ plugins: base.plugins }) !== serialize({ plugins })) dirty.push('plugins')
    if (serialize({ settings: base.settings }) !== serialize({ settings })) dirty.push('wordpress')
    return dirty
  }, [baseline, name, themes, plugins, settings])

  // Section status — drives the completion pill on each header
  const sectionStatus = useMemo(() => ({
    basics: {
      state: errors.name ? 'warning' : (name.trim() ? 'complete' : 'empty'),
      message: errors.name
        ? errors.name
        : (name.trim() ? 'Ready to save' : 'Add a name to save'),
    },
    setup: {
      state: errors.themes ? 'warning' :
        (themes.length === 0 || !themes.some((t) => t.isDefault)
          ? 'warning' : 'complete'),
      message: errors.themes || 'Themes & plugins ready',
    },
    wordpress: {
      state: 'complete',
      message: `Locale ${settings.language?.toUpperCase() || ''} · ${settings.timezone?.split('/').pop()?.replace('_', ' ') || ''}`,
    },
  }), [name, themes, errors, settings])

  const handleSave = useCallback(async () => {
    const errs = {}
    if (!name.trim()) errs.name = 'Add a name to save'
    if (themes.length === 0) errs.themes = 'Add at least one theme'
    if (!themes.some((t) => t.isDefault)) errs.themes = 'Mark one theme as default'
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      showToast.error('Check the highlighted sections', 'Fix the issues and save again.')
      // Focus the first errored field if possible
      setTimeout(() => {
        if (errs.name) {
          document.getElementById('bp-name')?.focus()
        }
      }, 0)
      return
    }
    setSubmitting(true)
    try {
      await onSave({
        name: name.trim(),
        themes,
        plugins,
        settings,
      })
    } catch (err) {
      showToast.error(err?.message || 'Failed to save blueprint')
    } finally {
      setSubmitting(false)
    }
  }, [name, themes, plugins, settings, onSave])

  const handleCancel = useCallback(() => {
    if (isDirty) {
      setConfirmCancel(true)
    } else {
      router.push('/blueprints')
    }
  }, [isDirty, router])

  // Cmd+S / Ctrl+S — save shortcut
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        if (!submitting) handleSave()
      } else if (e.key === 'Escape' && isDirty && !confirmCancel) {
        // Esc while dirty — confirm discard
        setConfirmCancel(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave, submitting, isDirty, confirmCancel])

  return (
    <PageContainer size="md" className="pb-32">
      {/* Breadcrumb */}
      <PageBreadcrumb
        items={breadcrumbs || [
          { label: 'Blueprints', href: '/blueprints' },
          { label: isEdit ? initial?.name || 'Edit' : 'New blueprint' },
        ]}
        className="mb-3"
      />

      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 mb-6">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
              <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                  {isEdit ? 'Edit blueprint' : 'Create blueprint'}
                </h1>
                {isDirty && (
                  <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-2xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {dirtySections.length} change{dirtySections.length === 1 ? '' : 's'} pending
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {isEdit
                  ? `Editing "${initial?.name}"`
                  : 'Reusable WordPress configuration for new sites'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={submitting} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} loading={submitting} className="flex-1 sm:flex-none">
              <Save className="h-4 w-4" />
              {isEdit ? 'Save changes' : 'Create blueprint'}
            </Button>
          </div>
        </div>
      </div>

      {/* Three sections */}
      <div className="space-y-5">
        {/* 1. Basics */}
        <Section def={SECTION_DEFS[0]} status={sectionStatus.basics}>
          <div className="space-y-1.5 max-w-lg">
            <Label htmlFor="bp-name" className="text-sm">Blueprint name</Label>
            <Input
              id="bp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Blog — Starter"
              className={cn('h-10', errors.name && 'border-red-500 focus:ring-red-500/30')}
              autoFocus={!isEdit}
              aria-invalid={!!errors.name}
              data-error={!!errors.name}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Shows as the title on the list page and as the template name in the new-app flow.
            </p>
            {errors.name && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.name}</p>
            )}
          </div>
        </Section>

        {/* 2. Setup — themes + plugins */}
        <Section def={SECTION_DEFS[1]} status={sectionStatus.setup}>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Themes</h3>
              <ThemePicker value={themes} onChange={setThemes} />
              {errors.themes && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2" data-error="true">{errors.themes}</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Plugins</h3>
              <PluginPicker
                value={plugins}
                onChange={(next) => {
                  if (next === '__clear_all__') setPlugins([])
                  else setPlugins(next)
                }}
              />
            </div>
          </div>
        </Section>

        {/* 3. WordPress — General + Advanced sub-cards */}
        <Section def={SECTION_DEFS[2]} status={sectionStatus.wordpress}>
          <div className="space-y-5">
            {/* General: locale + permalink (always shown) */}
            <SubCard
              title="General"
              description="Locale, timezone, permalinks — things every site needs."
            >
              <BlueprintSettingsForm
                settings={{
                  language: settings.language,
                  timezone: settings.timezone,
                  dateFormat: settings.dateFormat,
                  timeFormat: settings.timeFormat,
                }}
                onChange={(s) => setSettings({ ...settings, ...s })}
                onlySection="locale"
              />
              <div className="mt-6">
                <BlueprintSettingsForm
                  settings={{ permalinkStructure: settings.permalinkStructure }}
                  onChange={(s) => setSettings({ ...settings, ...s })}
                  onlySection="permalink"
                />
              </div>
            </SubCard>

            {/* Advanced: privacy + debug (collapsible, default closed) */}
            <SubCard
              title="Advanced settings"
              description="Privacy and debug toggles. Most sites leave these at their defaults."
              advanced
              collapsible
              open={advancedOpen}
              onOpenChange={setAdvancedOpen}
            >
              <BlueprintSettingsForm
                settings={{
                  disableSearchIndexing: settings.disableSearchIndexing,
                  organizeUploads: settings.organizeUploads,
                }}
                onChange={(s) => setSettings({ ...settings, ...s })}
                onlySection="privacy"
              />
              <div className="mt-6">
                <BlueprintSettingsForm
                  settings={{
                    debugMode: settings.debugMode,
                    debugLog: settings.debugLog,
                    displayErrors: settings.displayErrors,
                  }}
                  onChange={(s) => setSettings({ ...settings, ...s })}
                  onlySection="debug"
                />
              </div>
            </SubCard>
          </div>
        </Section>

        {/* Bottom save bar */}
        <div className="pt-6 mt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs">
            {isDirty ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  {dirtySections.length} section{dirtySections.length === 1 ? '' : 's'} with unsaved changes
                </span>
                <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">
                  · Sections touched: {dirtySections.join(', ')}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-slate-500 dark:text-slate-400">All changes saved</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-flex h-6 px-1.5 items-center text-2xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded">
              ⌘S
            </kbd>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} loading={submitting}>
              <Save className="h-4 w-4" />
              {isEdit ? 'Save changes' : 'Create blueprint'}
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm cancel if dirty */}
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Discard unsaved changes?"
        description={`You have ${dirtySections.length} unsaved section${dirtySections.length === 1 ? '' : 's'}. Leave anyway?`}
        confirmText="Discard changes"
        cancelText="Keep editing"
        variant="destructive"
        icon={<X className="h-4 w-4" />}
        onConfirm={() => router.push('/blueprints')}
      />
    </PageContainer>
  )
}

// ---------------------------------------------------------------------------
// Section — card with title, description, optional completion pill
// ---------------------------------------------------------------------------

const SECTION_DEFS = [
  {
    id: 'basics',
    title: 'Basics',
    description: 'Name your blueprint.',
    icon: Info,
  },
  {
    id: 'setup',
    title: 'Setup',
    description: 'Add as many themes and plugins as you want. Mark one of each as the default — the default theme is the one that gets activated when a site is created.',
    icon: Palette,
  },
  {
    id: 'wordpress',
    title: 'WordPress',
    description: 'Locale, permalinks, and developer toggles. All baked into wp-config and the database when a site is created.',
    icon: Settings,
  },
]

function Section({ def, status, children }) {
  const Icon = def.icon
  return (
    <Card className="overflow-hidden border-slate-200/80 dark:border-slate-800/80">
      <div className="px-5 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{def.title}</h2>
            <StatusPill status={status} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{def.description}</p>
        </div>
      </div>
      <div className="p-5">
        {children}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// StatusPill — small badge with completion state
// ---------------------------------------------------------------------------

function StatusPill({ status }) {
  if (!status) return null
  if (status.state === 'complete') {
    return (
      <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-2xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25" title={status.message}>
        <CheckCircle2 className="h-3 w-3" />
        Complete
      </span>
    )
  }
  if (status.state === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-2xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25" title={status.message}>
        <AlertCircle className="h-3 w-3" />
        Needs setup
      </span>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// SubCard — nested card inside the WordPress section for General / Advanced
// ---------------------------------------------------------------------------

function SubCard({ title, description, advanced = false, collapsible = false, open = true, onOpenChange, children }) {
  const [internalOpen, setInternalOpen] = useState(open)
  const isOpen = collapsible ? internalOpen : true
  const handleToggle = () => {
    if (!collapsible) return
    const next = !isOpen
    setInternalOpen(next)
    onOpenChange?.(next)
  }
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40 overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        disabled={!collapsible}
        className={cn(
          'w-full px-4 py-3 flex items-center gap-3 text-left',
          collapsible && 'hover:bg-slate-100/60 dark:hover:bg-slate-800/60 cursor-pointer transition-colors',
          !collapsible && 'cursor-default',
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
            {advanced && (
              <span className="inline-flex items-center h-4 px-1.5 rounded text-2xs font-medium bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                Advanced
              </span>
            )}
            {collapsible && !isOpen && (
              <span className="text-2xs text-slate-400 dark:text-slate-500 italic">collapsed — click to expand</span>
            )}
          </div>
          {isOpen && description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          )}
        </div>
        {collapsible && (
          <svg
            className={cn(
              'h-4 w-4 text-slate-400 transition-transform shrink-0',
              isOpen && 'rotate-180',
            )}
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
          {children}
        </div>
      )}
    </div>
  )
}

function serialize(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort())
}
