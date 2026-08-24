'use client'

import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Loader2,
  Check,
  Search,
  X,
  Plus,
  Pencil,
  Save,
  ChevronDown,
  ChevronRight,
  Eye,
  Wrench,
  Lock,
} from 'lucide-react'
import { showToast } from '@/utils/toast-utils'
import { cn } from '@/utils'

import {
  PERMISSIONS,
  PERMISSION_LEVELS,
  sanitizePermissions,
  humanizeSubLevel,
  getPermissionAncestorNames,
} from '@/lib/permissions'
import * as api from '@/services/centralApi'

// Create/Edit Role dialog.
//
// Owns its own controlled form state for name/title/description plus
// a separate `selectedPermissionIds` array kept out of the form state
// because the UI is a toggle grid, not a text field.
//
// Permission UI structure (revised 2026-07-10):
//   1. Three level tabs at the top (Organization / Applications /
//      Servers) with selection counts.
//   2. Within a level, permissions are grouped by `sub_level` into
//      collapsible sections (e.g. "Backup (3)", "Database (2)").
//   3. Each section lists permissions as one row per (raw_name) with
//      two toggle pills (view / manage). One row collapses what was
//      previously two rows.
//   4. Each row has a one-line description so users know what the
//      permission actually lets them do.
//   5. Selected permissions show an inline "includes N parent(s)" hint
//      so users understand why their saved role has more permissions
//      than the count they toggled.
//
// In Create mode all three text fields are required. In Edit mode the
// name is locked (not changeable post-create) and title/description
// are optional. Permissions are always editable in Edit mode EXCEPT
// for system roles, where the toggle grid is read-only — system role
// permissions are baked in (Admin = all, Member = view-only).
export function RoleFormModal({ open, onOpenChange, mode, role, onSuccess }) {
  const isEdit = mode === 'edit'
  const isSystemRole = !!role?.isSystem

  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([])
  const [activeLevel, setActiveLevel] = useState('organization')
  const [permFilter, setPermFilter] = useState('')
  const [collapsedSubs, setCollapsedSubs] = useState({})
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  // Reset state every time the dialog opens or the target role changes.
  useEffect(() => {
    if (!open) return
    setName(role?.name || '')
    setTitle(role?.title || '')
    setDescription(role?.description || '')
    setSelectedPermissionIds(role?.permissions || [])
    setActiveLevel('organization')
    setPermFilter('')
    setCollapsedSubs({})
    setErrors({})
  }, [open, role?.id])

  // All permissions in the active level, grouped by (raw_name, sub_level)
  // so the UI can render one row per permission name with view+manage
  // toggles. Within each sub_level, rows are sorted by order_by.
  const groupedPerms = useMemo(() => {
    const inLevel = PERMISSIONS.filter((p) => p.level === activeLevel)
    // Map raw_name → { view: perm, manage: perm, sub_level, order_by, title, description }
    const byName = new Map()
    for (const p of inLevel) {
      const key = p.raw_name
      if (!byName.has(key)) {
        byName.set(key, {
          raw_name: key,
          title: p.title,
          description: p.description,
          sub_level: p.sub_level,
          order_by: p.order_by,
          view: null,
          manage: null,
        })
      }
      const entry = byName.get(key)
      entry[p.action] = p
    }
    // Now bucket by sub_level
    const bySub = new Map()
    for (const row of byName.values()) {
      const sub = row.sub_level || 'other'
      if (!bySub.has(sub)) bySub.set(sub, [])
      bySub.get(sub).push(row)
    }
    // Sort rows within each sub by order_by
    for (const rows of bySub.values()) {
      rows.sort((a, b) => a.order_by - b.order_by)
    }
    // Sort sub_levels by min order_by so sections appear in a
    // predictable order even when titles repeat.
    const subOrder = Array.from(bySub.entries()).sort((a, b) => {
      const ao = Math.min(...a[1].map((r) => r.order_by))
      const bo = Math.min(...b[1].map((r) => r.order_by))
      return ao - bo
    })
    return subOrder.map(([sub, rows]) => ({ sub_level: sub, rows }))
  }, [activeLevel])

  // Apply the search filter. Returns a copy of groupedPerms with rows
  // that don't match removed and empty sections dropped.
  const visibleGroups = useMemo(() => {
    const q = permFilter.trim().toLowerCase()
    if (!q) return groupedPerms
    const out = []
    for (const group of groupedPerms) {
      const rows = group.rows.filter((r) =>
        (r.title || r.raw_name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.sub_level || '').toLowerCase().includes(q)
      )
      if (rows.length > 0) out.push({ sub_level: group.sub_level, rows })
    }
    return out
  }, [groupedPerms, permFilter])

  const totalSelectedInLevel = useMemo(() => {
    return PERMISSIONS.filter(
      (p) => p.level === activeLevel && selectedPermissionIds.includes(p.name)
    ).length
  }, [selectedPermissionIds, activeLevel])

  // Toggle the view or manage action for a row. The underlying storage
  // keys are composite names (`level.raw_name.action`), so toggling
  // view/manage only affects that one permission. Per production data
  // shape, view and manage are siblings (manage does NOT auto-grant
  // view); users who want both must toggle each separately.
  const toggleAction = (row, action) => {
    if (isSystemRole) return
    const permName = `${activeLevel}.${row.raw_name}.${action}`
    setSelectedPermissionIds((prev) => {
      if (prev.includes(permName)) return prev.filter((x) => x !== permName)
      return [...prev, permName]
    })
  }

  // "Select all view" / "Select all manage" toggle per level — useful
  // Total effective count after auto-include — used in the "X explicit,
  // Y total after parents" hint near the section list.
  const effectiveCount = useMemo(() => {
    const set = new Set(selectedPermissionIds)
    for (const n of selectedPermissionIds) {
      for (const ancestor of getPermissionAncestorNames(n)) {
        set.add(ancestor)
      }
    }
    return set.size
  }, [selectedPermissionIds])

  const toggleSubCollapsed = (sub) => {
    setCollapsedSubs((prev) => ({ ...prev, [sub]: !prev[sub] }))
  }

  // Apply a single action (view | manage) to every row in `group`,
  // clearing or adding as appropriate. Mirrors `setLevelAction` but
  // scoped to one sub-section so the blast radius is small. Returns
  // true if anything was changed so callers can show feedback.
  const applyToGroup = (group, action, value) => {
    if (isSystemRole) return false
    const ids = []
    for (const r of group.rows) {
      const perm = action === 'view' ? r.view : r.manage
      if (perm) ids.push(perm.name)
    }
    if (ids.length === 0) return false
    setSelectedPermissionIds((prev) => {
      const set = new Set(prev)
      ids.forEach((id) => {
        if (value) set.add(id); else set.delete(id)
      })
      return Array.from(set)
    })
    // Auto-expand the section if it was collapsed so users can see
    // what just changed.
    setCollapsedSubs((prev) => prev[group.sub_level] === true ? { ...prev, [group.sub_level]: false } : prev)
    return true
  }

  // For a sub-section, compute the count of explicit selections,
  // the catalog max, and the count after walking parents (so the
  // header can show "5 / 16 / 18 granted · after parents").
  const computeGroupCounts = (group) => {
    const explicit = group.rows.reduce((acc, r) => {
      let c = 0
      if (r.view && selectedPermissionIds.includes(r.view.name)) c++
      if (r.manage && selectedPermissionIds.includes(r.manage.name)) c++
      return acc + c
    }, 0)
    const total = group.rows.reduce((acc, r) => {
      let c = 0
      if (r.view) c++
      if (r.manage) c++
      return acc + c
    }, 0)
    // After auto-include: walk each explicitly-selected composite name
    // in this group through the allow_parent_ids chain.
    const effective = new Set()
    const collect = (row) => {
      if (!row) return
      if (row.view && selectedPermissionIds.includes(row.view.name)) {
        for (const a of getPermissionAncestorNames(row.view.name)) effective.add(a)
      }
      if (row.manage && selectedPermissionIds.includes(row.manage.name)) {
        for (const a of getPermissionAncestorNames(row.manage.name)) effective.add(a)
      }
    }
    for (const r of group.rows) collect(r)
    return { explicit, total, effective: effective.size }
  }

  const validate = () => {
    const next = {}
    if (!isEdit) {
      if (!/^[a-z][a-z0-9_-]*$/.test(name.trim()) || name.trim().length < 2 || name.trim().length > 50) {
        next.name = 'Name must be 2-50 chars, lowercase letters/digits/underscores/hyphens, start with a letter'
      }
    }
    if (title.trim().length < 2 || title.trim().length > 100) {
      next.title = 'Title must be 2-100 characters'
    }
    if (description.length > 500) {
      next.description = 'Description must be at most 500 characters'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setIsSaving(true)
    try {
      const safePerms = sanitizePermissions(selectedPermissionIds)
      if (isEdit && role) {
        const payload = {
          title: title.trim(),
          description: description.trim(),
        }
        if (!isSystemRole) payload.permissions = safePerms
        await api.updateRole(role.id, payload)
        showToast.success('Role updated')
      } else {
        await api.createRole({
          name: name.trim(),
          title: title.trim(),
          description: description.trim(),
          permissions: safePerms,
        })
        showToast.success('Role created')
      }
      onSuccess?.()
    } catch (err) {
      const msg = err?.message || 'Failed to save role'
      if (msg.toLowerCase().includes('name')) {
        setErrors((prev) => ({ ...prev, name: msg }))
      } else if (msg.toLowerCase().includes('title')) {
        setErrors((prev) => ({ ...prev, title: msg }))
      } else if (msg.toLowerCase().includes('description')) {
        setErrors((prev) => ({ ...prev, description: msg }))
      } else {
        showToast.error(msg)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const availableLevels = Object.keys(PERMISSION_LEVELS)
  const hasAnySelected = selectedPermissionIds.length > 0
  const autoIncludedCount = Math.max(0, effectiveCount - selectedPermissionIds.length)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        header={
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-start gap-4 pr-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                {isEdit ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-slate-900 dark:text-white text-xl">
                  {isEdit ? 'Edit Role' : 'Create Role'}
                </DialogTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {isEdit
                    ? isSystemRole
                      ? `${role?.title || role?.name} is a built-in role. Title and description can be edited; permissions are fixed.`
                      : `Update title, description, or permissions for ${role?.name}.`
                    : 'Define a new role and assign its permissions.'}
                </p>
              </div>
            </div>
          </DialogHeader>
        }
        footer={
          <div className="px-6 py-4 flex justify-between items-center gap-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {hasAnySelected
                ? `${selectedPermissionIds.length} explicit${autoIncludedCount > 0 ? ` · ${autoIncludedCount} auto-included` : ''} · ${effectiveCount} total`
                : 'No permissions selected'}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="h-11 px-5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="role-form"
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isEdit ? (
                  <Save className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {isEdit ? 'Save Changes' : 'Create Role'}
              </button>
            </div>
          </div>
        }
      >
        <form id="role-form" onSubmit={onSubmit} className="px-6 py-4 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="role-name" className="text-slate-700 dark:text-slate-300 text-sm font-medium block">
                Name
              </label>
              <input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. read_only"
                disabled={isEdit}
                className="h-10 w-full px-3 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 disabled:opacity-60"
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              {isEdit && !errors.name && (
                <p className="text-2xs text-slate-500 dark:text-slate-400">Name cannot be changed after creation.</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="role-title" className="text-slate-700 dark:text-slate-300 text-sm font-medium block">
                Title
              </label>
              <input
                id="role-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Read-only"
                className="h-10 w-full px-3 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="role-description" className="text-slate-700 dark:text-slate-300 text-sm font-medium block">
              Description <span className="text-slate-400 dark:text-slate-500 text-xs font-normal">(optional)</span>
            </label>
            <input
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this role is for"
              className="h-10 w-full px-3 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400"
            />
            {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-slate-700 dark:text-slate-300 text-sm font-medium">Permissions</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {selectedPermissionIds.length} explicit · {effectiveCount} after auto-include
              </span>
              {isSystemRole && (
                <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Built-in role — permissions are fixed.
                </span>
              )}
            </div>

            {/* Level tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
              {availableLevels.map((level) => {
                const isActive = level === activeLevel
                const total = PERMISSIONS.filter((p) => p.level === level).length
                const count = PERMISSIONS.filter(
                  (p) => p.level === level && selectedPermissionIds.includes(p.name)
                ).length
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => { setActiveLevel(level); setPermFilter('') }}
                    className={cn(
                      'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                      isActive
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:hover:text-slate-200'
                    )}
                  >
                    {PERMISSION_LEVELS[level].label}
                    <span className="ml-1.5 text-xs text-slate-500 dark:text-slate-400">({count}/{total})</span>
                  </button>
                )
              })}
            </div>

            {/* Search row with live result count.
                The toolbar previously held "Grant view / Grant manage"
                buttons that toggled permissions across the whole level
                in a single click — they were foot-guns (one click could
                grant 16+ permissions). They've been replaced by the
                scoped section-header buttons below so users can only
                bulk-toggle within a single sub-section at a time. */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                <input
                  placeholder="Filter permissions in this level..."
                  value={permFilter}
                  onChange={(e) => setPermFilter(e.target.value)}
                  className="w-full pl-9 h-10 text-xs rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>
              {permFilter && (
                <button
                  type="button"
                  onClick={() => setPermFilter('')}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                  title="Clear filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {permFilter && (
              <p className="text-2xs text-slate-500 dark:text-slate-400 -mt-1 ml-1">
                {(() => {
                  const n = visibleGroups.reduce((acc, g) => acc + g.rows.length, 0)
                  const totalInLevel = groupedPerms.reduce((acc, g) => acc + g.rows.length, 0)
                  if (n === 0) return `No permissions in ${PERMISSION_LEVELS[activeLevel].label} match “${permFilter}”`
                  return `${n} of ${totalInLevel} permission${totalInLevel === 1 ? '' : 's'} in ${PERMISSION_LEVELS[activeLevel].label} match`
                })()}
              </p>
            )}

            {/* Permission list — grouped by sub_level */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-[55vh] overflow-y-auto">
              {visibleGroups.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No permissions match</p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700/60">
                  {visibleGroups.map((group) => {
                    const collapsed = collapsedSubs[group.sub_level]
                    const subSelectedCount = group.rows.reduce((acc, r) => {
                      let c = 0
                      if (r.view && selectedPermissionIds.includes(r.view.name)) c++
                      if (r.manage && selectedPermissionIds.includes(r.manage.name)) c++
                      return acc + c
                    }, 0)
                    const subTotal = group.rows.reduce((acc, r) => {
                      let c = 0
                      if (r.view) c++
                      if (r.manage) c++
                      return acc + c
                    }, 0)
                    const { explicit, total, effective } = computeGroupCounts(group)
                    const viewAllOn = group.rows.every((r) => r.view && selectedPermissionIds.includes(r.view.name))
                    const manageAllOn = group.rows.every((r) => r.manage && selectedPermissionIds.includes(r.manage.name))
                    const anyManage = group.rows.some((r) => r.manage)
                    const anyView = group.rows.some((r) => r.view)
                    return (
                      <div key={group.sub_level}>
                        {/* Section header. Two regions: a clickable left
                            half (collapse toggle) and a right-side mini
                            toolbar (per-section bulk buttons). The bulk
                            buttons only operate on this section so the
                            blast radius is small. Auto-include math is
                            shown inline so users see the full grant
                            picture at the same place they see the count. */}
                        <div className="flex items-center bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => toggleSubCollapsed(group.sub_level)}
                            className="flex-1 min-w-0 flex items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
                          >
                            {collapsed ? (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="truncate">{humanizeSubLevel(group.sub_level, activeLevel) || group.sub_level}</span>
                            <span className="ml-auto text-xxs font-normal normal-case text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                              {explicit}/{total} granted
                              {effective > explicit && ` · ${effective} after parents`}
                            </span>
                          </button>
                          {!isSystemRole && !collapsed && (
                            <div className="flex items-center gap-1 pr-3 pl-1">
                              <button
                                type="button"
                                disabled={!anyView}
                                onClick={() => applyToGroup(group, 'view', !viewAllOn)}
                                className="h-7 px-2 text-2xs rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 dark:hover:bg-slate-700 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={viewAllOn ? 'Remove view from every row in this section' : 'Grant view to every row in this section'}
                              >
                                {viewAllOn ? 'Clear view' : 'View all'}
                              </button>
                              <button
                                type="button"
                                disabled={!anyManage}
                                onClick={() => applyToGroup(group, 'manage', !manageAllOn)}
                                className="h-7 px-2 text-2xs rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 dark:hover:bg-slate-700 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={manageAllOn ? 'Remove manage from every row in this section' : 'Grant manage to every row in this section'}
                              >
                                {manageAllOn ? 'Clear manage' : 'Manage all'}
                              </button>
                            </div>
                          )}
                        </div>
                        {!collapsed && (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {group.rows.map((row) => (
                              <PermissionRow
                                key={row.raw_name}
                                row={row}
                                level={activeLevel}
                                selectedPermissionIds={selectedPermissionIds}
                                onToggleAction={toggleAction}
                                disabled={isSystemRole}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {totalSelectedInLevel === 0 && visibleGroups.length > 0 && !permFilter && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tip: this role will have no {PERMISSION_LEVELS[activeLevel].label.toLowerCase()} permissions.
              </p>
            )}

            {/* Live preview: "What this role can do."
                Translates the abstract permission set into plain English
                grouped by level. Updates on every toggle so users can
                see what their role actually grants without doing mental
                math. Top 3 items per level; "+N more" if longer. */}
            <CapabilityPreview
              selectedPermissionIds={selectedPermissionIds}
              effectiveCount={effectiveCount}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// One permission row in the picker. Renders a title + one-line
// description + two toggle pills (view / manage). When a selection
// pulls in additional parent permissions (via allow_parent_ids), an
// inline hint shows the count so the user understands why their saved
// role has more permissions than the toggles suggest.
function PermissionRow({ row, level, selectedPermissionIds, onToggleAction, disabled }) {
  const viewOn = row.view && selectedPermissionIds.includes(row.view.name)
  const manageOn = row.manage && selectedPermissionIds.includes(row.manage.name)

  // Compute auto-included parents for the currently-on actions.
  const parentNames = new Set()
  if (viewOn) for (const a of getPermissionAncestorNames(row.view.name)) parentNames.add(a)
  if (manageOn) for (const a of getPermissionAncestorNames(row.manage.name)) parentNames.add(a)
  // Don't count the toggled rows themselves as "parents".
  if (row.view) parentNames.delete(row.view.name)
  if (row.manage) parentNames.delete(row.manage.name)
  const parentCount = parentNames.size

  // Lookup parent titles for the hint text.
  const parentHints = Array.from(parentNames).slice(0, 3).map((n) => {
    // n is composite — look up via PERMISSIONS for the title.
    const found = PERMISSIONS.find((p) => p.name === n)
    return found ? (found.title || found.raw_name) : n
  })

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 transition-colors',
        disabled ? 'opacity-60' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50/60 dark:hover:bg-slate-800/30',
        (viewOn || manageOn) && !disabled && 'bg-indigo-50/40 dark:bg-indigo-500/5'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-sm font-medium',
            (viewOn || manageOn)
              ? 'text-indigo-700 dark:text-indigo-300'
              : 'text-slate-800 dark:text-slate-200'
          )}>
            {row.title || row.raw_name}
          </span>
          {row.sub_level && row.sub_level !== (humanizeSubLevel(row.sub_level, level) || row.sub_level) && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wide bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 shrink-0">
              {humanizeSubLevel(row.sub_level, level)}
            </span>
          )}
        </div>
        {row.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            {row.description}
          </p>
        )}
        {parentCount > 0 && (
          <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
            <span className="font-mono">↳</span>
            <span>includes {parentCount} parent {parentCount === 1 ? 'permission' : 'permissions'}</span>
            {parentHints.length > 0 && (
              <span className="text-slate-400 dark:text-slate-500">
                ({parentHints.join(', ')}{parentCount > parentHints.length ? '…' : ''})
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <TogglePill
          label="View"
          icon={Eye}
          active={!!viewOn}
          disabled={disabled || !row.view}
          onClick={() => row.view && onToggleAction(row, 'view')}
          rowTitle={row.title || row.raw_name}
        />
        <TogglePill
          label="Manage"
          icon={Wrench}
          active={!!manageOn}
          disabled={disabled || !row.manage}
          onClick={() => row.manage && onToggleAction(row, 'manage')}
          rowTitle={row.title || row.raw_name}
        />
      </div>
    </div>
  )
}

// Small segmented toggle pill used for the per-row view/manage actions.
// Slightly bigger than the toolbar version (h-10 vs h-8) so each row's
// toggle gets visual weight equal to its label. `role="switch"` +
// `aria-pressed` so screen readers treat it as a true toggle instead
// of a button that opens something.
function TogglePill({ label, icon: Icon, active, disabled, onClick, rowTitle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-pressed={!!active}
      aria-label={`${label} permission for ${rowTitle}`}
      onClick={onClick}
      disabled={disabled}
      title={
        disabled && label === 'Manage'
          ? `No manage permission is available for ${rowTitle} in this catalog.`
          : `${active ? 'Remove' : 'Grant'} ${label.toLowerCase()} for ${rowTitle}`
      }
      className={cn(
        'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border transition-colors min-w-[76px] justify-center',
        active
          ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-500 hover:border-indigo-500 shadow-sm'
          : disabled
            ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 dark:hover:border-slate-600',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {active && <Check className="h-3 w-3 -mr-1" />}
    </button>
  )
}

// Live preview panel — renders a plain-English summary of the current
// permission set, grouped by level. Shows the top 3 capabilities per
// level so the modal stays compact, plus a "+N more" line if longer.
// Driven entirely off the canonical PERMISSIONS catalog and the
// selectedPermissionIds prop, so it stays in sync with the picker
// without any extra state.
function CapabilityPreview({ selectedPermissionIds, effectiveCount }) {
  const [expanded, setExpanded] = useState(false)

  if (selectedPermissionIds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
        Nothing granted yet. Click View or Manage on any row to start.
        Auto-included parents will be added automatically.
      </div>
    )
  }

  // Build the set of *effective* permission names (selected + auto-
  // included parents) so the preview reflects what the role actually
  // grants, not just the raw toggles.
  const effectiveSet = useMemo(() => {
    const set = new Set()
    for (const n of selectedPermissionIds) {
      for (const a of getPermissionAncestorNames(n)) set.add(a)
    }
    return set
  }, [selectedPermissionIds])

  const set = effectiveSet

  // Group permissions by level for the preview summary.
  const byLevel = useMemo(() => {
    const out = { organization: [], application: [], server: [] }
    for (const n of set) {
      const p = PERMISSIONS.find((x) => x.name === n)
      if (!p) continue
      if (!out[p.level]) out[p.level] = []
      out[p.level].push(p)
    }
    for (const lvl of Object.keys(out)) {
      out[lvl].sort((a, b) => a.order_by - b.order_by)
    }
    return out
  }, [set])

  const hasAny = set.size > 0
  const cap = expanded ? Infinity : 3
  const showToggle = (lvl) => byLevel[lvl].length > cap

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800/70 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          What this role can do
        </span>
        <span className="text-2xs text-slate-500 dark:text-slate-400 tabular-nums">
          {hasAny ? `${effectiveCount} effective permission${effectiveCount === 1 ? '' : 's'}` : 'None'}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-3 border-t border-slate-200/70 dark:border-slate-700/70">
          {!hasAny && (
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-3">No effective permissions.</p>
          )}
          {hasAny && Object.entries(byLevel).map(([lvl, perms]) => {
            if (perms.length === 0) return null
            const visible = expanded ? perms : perms.slice(0, cap)
            const hidden = perms.length - visible.length
            return (
              <div key={lvl} className="pt-3">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {PERMISSION_LEVELS[lvl]?.label || lvl}
                  </span>
                  <span className="text-xxs text-slate-400 dark:text-slate-500 tabular-nums">
                    {perms.length} permission{perms.length === 1 ? '' : 's'}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {visible.map((p) => (
                    <li key={p.name} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                      <span className="text-slate-400 dark:text-slate-500 select-none mt-0.5">
                        {p.action === 'manage' ? '\u270e' : '\u25cb'}
                      </span>
                      <span>
                        <span className="font-medium">{p.title || p.raw_name}</span>
                        <span className="ml-1 text-xxs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {p.action}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                {!expanded && hidden > 0 && (
                  <p className="text-2xs text-slate-500 dark:text-slate-400 italic mt-1">
                    + {hidden} more — expand to see all
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
