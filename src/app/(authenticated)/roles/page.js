'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck, Plus, Pencil, Trash2, Search as SearchIcon, X as XIcon,
  KeyRound, Users as UsersIcon, Lock, AlertTriangle, Server as ServerIcon,
  Boxes, Activity, Building2, ChevronDown, Check,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { TypeaheadInput } from '@/components/ui/typeahead-input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState, PageContainer, PageHeader } from '@/components/ui/page'
import { StatRow } from '@/components/primitives/StatRow'
import { useListToolbarState } from '@/hooks/useListToolbarState'

import { useAuthStore } from '@/stores/authStore'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useCan } from '@/hooks/useCan'
import * as api from '@/services/centralApi'
import { showToast } from '@/utils/toast-utils'
import { cn } from '@/lib/utils'

import {
  PERMISSIONS, PERMISSION_LEVELS, ALL_PERMISSION_IDS,
  humanizeSubLevel,
} from '@/lib/permissions'

const LEVEL_ICONS = {
  organization: Building2,
  application:  Boxes,
  server:       ServerIcon,
}

const LEVEL_ACCENTS = {
  organization: 'indigo',
  application:  'violet',
  server:       'emerald',
}

export default function RolesPage() {
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  const canManage = useCan('organization.roles_permissions.manage')

  const [roles, setRoles] = useState([])
  const [memberships, setMemberships] = useState([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [viewingRole, setViewingRole] = useState(null)
  const tb = useListToolbarState()

  useEffect(() => {
    if (!activeOrgId) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const [r, m] = await Promise.all([
          api.listRolesForOrg(),
          api.listMembers().catch(() => []),
        ])
        if (!cancelled) {
          setRoles(r)
          setMemberships(m)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeOrgId])

  const stats = useMemo(() => {
    const total = roles.length
    const system = roles.filter((r) => r.isSystem).length
    const custom = roles.filter((r) => !r.isSystem).length
    const inUse = new Set(
      memberships
        .filter((m) => m.status === 'active' && m.roleId)
        .map((m) => m.roleId)
    ).size
    return { total, system, custom, inUse }
  }, [roles, memberships])

  const roleNames = useMemo(
    () => roles.map((r) => r.name || '').filter(Boolean),
    [roles]
  )

  const filteredRoles = useMemo(() => {
    const q = tb.search.trim().toLowerCase()
    if (!q) return roles
    return roles.filter((r) => {
      return (
        (r.title || '').toLowerCase().includes(q) ||
        (r.name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      )
    })
  }, [roles, tb.search])

  const usageCount = (roleId) =>
    memberships.filter((m) => m.status === 'active' && m.roleId === roleId).length

  const onCreate = () => {
    setEditingRole(null)
    setEditorOpen(true)
  }
  const onEdit = (role) => {
    setEditingRole(role)
    setEditorOpen(true)
  }
  const onDelete = async () => {
    if (!confirmDelete) return
    const using = usageCount(confirmDelete.id)
    if (using > 0) {
      showToast.error(`Cannot delete: ${using} member${using === 1 ? '' : 's'} still use this role. Reassign them first.`)
      setConfirmDelete(null)
      return
    }
    setDeleteBusy(true)
    try {
      await api.deleteRole(confirmDelete.id)
      showToast.success(`Deleted role ${confirmDelete.title}`)
      setConfirmDelete(null)
      const r = await api.listRolesForOrg()
      setRoles(r)
    } catch (err) {
      showToast.error(err?.message || 'Failed to delete role')
    } finally {
      setDeleteBusy(false)
    }
  }
  const onSaveRole = async (payload) => {
    try {
      if (editingRole) {
        await api.updateRole(editingRole.id, payload)
        showToast.success(`Updated ${payload.title || editingRole.title}`)
      } else {
        await api.createRole(payload)
        showToast.success(`Created ${payload.title}`)
      }
      setEditorOpen(false)
      const r = await api.listRolesForOrg()
      setRoles(r)
    } catch (err) {
      showToast.error(err?.message || 'Failed to save role')
    }
  }

  return (
    <PageContainer size="lg">
      <PageHeader
        eyebrow="Access control"
        title="Roles"
        description="Define what members in this organization can see and do. System roles cannot be deleted but their permissions are read-only."
      >
        {canManage && (
          <Button onClick={onCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Create role
          </Button>
        )}
      </PageHeader>

      <StatRow
        tiles={[
          { label: 'Total roles', value: stats.total, icon: ShieldCheck, tone: 'indigo', loading },
          { label: 'System roles', value: stats.system, icon: ShieldCheck, tone: 'indigo', loading },
          { label: 'Custom roles', value: stats.custom, icon: KeyRound, tone: 'violet', loading },
          { label: 'In use', value: stats.inUse, icon: UsersIcon, tone: 'emerald', loading },
        ]}
      />

      <Card className="p-3 sm:p-4 border-slate-200 dark:border-slate-700 overflow-visible">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <TypeaheadInput
              placeholder="Search roles by name, title, or description…"
              ariaLabel="Search roles"
              value={tb.searchInput}
              onChange={tb.setSearchInput}
              suggestions={roleNames}
              className="flex-1 min-w-[200px]"
            />
            {tb.searchInput && (
              <button
                type="button"
                onClick={() => tb.setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
                aria-label="Clear search"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          {tb.searchInput && (
            <Button variant="ghost" size="sm" onClick={() => tb.setSearchInput('')}>
              Clear
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <RoleSkeletonGrid />
      ) : roles.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No roles yet"
          description="Create your first custom role to grant scoped access to members."
          action={canManage ? { label: 'Create role', onClick: onCreate } : null}
        />
      ) : filteredRoles.length === 0 ? (
        <Card className="mt-4 p-10 text-center border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
          <SearchIcon className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">
            No roles match &ldquo;{tb.search}&rdquo;
          </p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => tb.setSearchInput('')}>
            Clear search
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredRoles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              usageCount={usageCount(role.id)}
              canManage={canManage}
              onView={() => setViewingRole(role)}
              onEdit={() => onEdit(role)}
              onDelete={() => setConfirmDelete(role)}
            />
          ))}
        </div>
      )}

      <RoleEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        role={editingRole}
        canManage={canManage}
        onSave={onSaveRole}
      />

      <RoleViewerDialog
        role={viewingRole}
        onOpenChange={(o) => !o && setViewingRole(null)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={`Delete "${confirmDelete?.title}"?`}
        description="Custom roles can be deleted. Members using this role must be reassigned first — the action will be blocked if any are still assigned."
        loading={deleteBusy}
        confirmLabel="Yes, delete role"
        confirmVariant="destructive"
        onConfirm={onDelete}
      >
        <></>
      </ConfirmDialog>
    </PageContainer>
  )
}

function RoleCard({ role, usageCount, canManage, onView, onEdit, onDelete }) {
  const permCount = (role.permissions || []).length
  const totalPerms = ALL_PERMISSION_IDS.length
  const inUse = usageCount > 0
  return (
    <Card className="p-0 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <button
        type="button"
        onClick={onView}
        className="text-left p-5 flex-1 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                {role.title}
              </h3>
              {role.isSystem && (
                <Badge variant="indigo" className="shrink-0">
                  <Lock className="h-3 w-3 mr-1" />
                  System
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              {role.name}
            </p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-300 shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
        {role.description && (
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 line-clamp-2">
            {role.description}
          </p>
        )}
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            <span className="tabular-nums font-medium text-slate-700 dark:text-slate-200">{permCount}</span>
            <span>of {totalPerms} permissions</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UsersIcon className="h-3.5 w-3.5" />
            <span className="tabular-nums font-medium text-slate-700 dark:text-slate-200">{usageCount}</span>
            <span>{usageCount === 1 ? 'member' : 'members'}</span>
          </span>
        </div>
      </button>
      {canManage && (
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit} className="gap-1">
            <Pencil className="h-3.5 w-3.5" />
            {role.isSystem ? 'View' : 'Edit'}
          </Button>
          {!role.isSystem && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={inUse}
              className="gap-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

function RoleEditorDialog({ open, onOpenChange, role, canManage, onSave }) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState(false)
  // Sections start expanded. User can collapse them to reduce scroll.
  const [expandedSections, setExpandedSections] = useState(
    () => new Set(Object.keys(PERMISSION_LEVELS))
  )
  const isSystem = !!role?.isSystem
  const isEdit = !!role

  useEffect(() => {
    if (open) {
      setName(role?.name || '')
      setTitle(role?.title || '')
      setDescription(role?.description || '')
      setSelected(new Set(role?.permissions || []))
      setExpandedSections(new Set(Object.keys(PERMISSION_LEVELS)))
    }
  }, [open, role])

  // Group permissions by (level, raw_name) so the UI renders one row per
  // resource with View + Manage pills, instead of two rows that share a
  // title. Storage keys stay composite (`level.name.action`) — only the
  // presentation is grouped.
  const groupedByLevel = useMemo(() => {
    const map = new Map() // level -> Map<raw_name, group>
    for (const p of PERMISSIONS) {
      let levelMap = map.get(p.level)
      if (!levelMap) { levelMap = new Map(); map.set(p.level, levelMap) }
      let g = levelMap.get(p.raw_name)
      if (!g) {
        g = {
          raw_name: p.raw_name,
          title: p.title,
          description: p.description,
          level: p.level,
          sub_level: p.sub_level,
          viewId: null,
          manageId: null,
        }
        levelMap.set(p.raw_name, g)
      }
      if (p.action === 'view') g.viewId = p.name
      else if (p.action === 'manage') g.manageId = p.name
    }
    return map
  }, [])

  // Cascade: granting Manage also grants View; revoking View also revokes
  // Manage. You can't manage what you can't see, and visually it's
  // confusing to have Manage on with View off. Backend `sanitizePermissions`
  // already enforces this on save via `allow_parent_ids` — the UI just
  // mirrors it so the user sees what's actually being stored.
  const toggleView = (g) => {
    if (isSystem || !g.viewId) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(g.viewId)) {
        next.delete(g.viewId)
        if (g.manageId) next.delete(g.manageId) // revoke view -> revoke manage
      } else {
        next.add(g.viewId)
      }
      return next
    })
  }
  const toggleManage = (g) => {
    if (isSystem || !g.manageId) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(g.manageId)) {
        next.delete(g.manageId)
      } else {
        next.add(g.manageId)
        if (g.viewId) next.add(g.viewId) // grant manage -> grant view
      }
      return next
    })
  }

  const selectAllInLevel = (levelKey) => {
    if (isSystem) return
    const groups = groupedByLevel.get(levelKey)
    if (!groups) return
    setSelected((prev) => {
      const next = new Set(prev)
      for (const g of groups.values()) {
        if (g.viewId) next.add(g.viewId)
        if (g.manageId) next.add(g.manageId)
      }
      return next
    })
  }
  const deselectAllInLevel = (levelKey) => {
    if (isSystem) return
    const groups = groupedByLevel.get(levelKey)
    if (!groups) return
    setSelected((prev) => {
      const next = new Set(prev)
      for (const g of groups.values()) {
        if (g.viewId) next.delete(g.viewId)
        if (g.manageId) next.delete(g.manageId)
      }
      return next
    })
  }
  const selectAllGlobal = () => {
    if (isSystem) return
    setSelected(new Set(ALL_PERMISSION_IDS))
  }
  const clearAllGlobal = () => {
    if (isSystem) return
    setSelected(new Set())
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await onSave({
        name: name.trim().toLowerCase(),
        title: title.trim(),
        description: description.trim(),
        permissions: Array.from(selected),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? (isSystem ? `View ${role.title}` : `Edit ${role.title}`) : 'Create custom role'}
      confirmLabel={isSystem ? 'Close' : (isEdit ? 'Save changes' : 'Create role')}
      onConfirm={isSystem ? () => onOpenChange(false) : onSubmit}
      loading={busy}
      size="lg"
      className="max-w-3xl"
    >
      <form onSubmit={onSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-2 pb-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEdit}
              placeholder="e.g. billing"
              autoComplete="off"
              className="mt-1.5 h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-mono focus-visible:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2 focus-visible:[box-shadow:none] focus-visible:[--tw-ring-shadow:0_0_0_0_transparent]"
            />
            <p className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
              Lowercase letters, digits, underscores, hyphens. Immutable after creation.
            </p>
          </div>
          <div>
            <Label htmlFor="role-title">Title</Label>
            <Input
              id="role-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSystem}
              placeholder="e.g. Billing Manager"
              autoComplete="off"
              className="mt-1.5 h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-2 focus-visible:[box-shadow:none] focus-visible:[--tw-ring-shadow:0_0_0_0_transparent]"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="role-description">Description</Label>
          <textarea
            id="role-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSystem}
            placeholder="What this role can do in plain English."
            rows={2}
            className="mt-1.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2 gap-3">
            <Label className="m-0">Permissions</Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  selected.size === ALL_PERMISSION_IDS.length
                    ? clearAllGlobal()
                    : selectAllGlobal()
                }
                disabled={isSystem}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selected.size === ALL_PERMISSION_IDS.length ? 'Clear all' : 'Select all'}
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {selected.size} of {ALL_PERMISSION_IDS.length} selected
              </span>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-3">
            {Object.keys(PERMISSION_LEVELS).map((levelKey) => {
              const level = PERMISSION_LEVELS[levelKey]
              const LevelIcon = LEVEL_ICONS[levelKey] || ShieldCheck
              const accent = LEVEL_ACCENTS[levelKey] || 'slate'
              const groupsMap = groupedByLevel.get(levelKey)
              const groups = groupsMap ? Array.from(groupsMap.values()) : []
              let selectedInLevel = 0
              let totalInLevel = 0
              for (const g of groups) {
                if (g.viewId) { totalInLevel++; if (selected.has(g.viewId)) selectedInLevel++ }
                if (g.manageId) { totalInLevel++; if (selected.has(g.manageId)) selectedInLevel++ }
              }
              const allLevelSelected = totalInLevel > 0 && selectedInLevel === totalInLevel
              const isExpanded = expandedSections.has(levelKey)
              return (
                <div key={levelKey} className="bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedSections((prev) => {
                        const next = new Set(prev)
                        if (next.has(levelKey)) next.delete(levelKey)
                        else next.add(levelKey)
                        return next
                      })
                    }}
                    disabled={isSystem}
                    aria-expanded={isExpanded}
                    className="group w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-md disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200',
                          !isExpanded && '-rotate-90',
                        )}
                      />
                      <LevelIcon className={cn(
                        'h-4 w-4 shrink-0',
                        accent === 'indigo'  && 'text-indigo-600 dark:text-indigo-400',
                        accent === 'violet'  && 'text-violet-600 dark:text-violet-400',
                        accent === 'emerald' && 'text-emerald-600 dark:text-emerald-400',
                      )} />
                      <span className="font-medium text-sm text-slate-900 dark:text-white">{level.label}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {selectedInLevel} / {totalInLevel}
                      </span>
                    </div>
                    <span
                      role="button"
                      tabIndex={isSystem ? -1 : 0}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isSystem) return
                        allLevelSelected ? deselectAllInLevel(levelKey) : selectAllInLevel(levelKey)
                      }}
                      onKeyDown={(e) => {
                        if (isSystem) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          allLevelSelected ? deselectAllInLevel(levelKey) : selectAllInLevel(levelKey)
                        }
                      }}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-1"
                    >
                      {allLevelSelected ? 'Clear' : 'Select all'}
                    </span>
                  </button>
                  {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                    {groups.map((g) => {
                      const viewOn = !!(g.viewId && selected.has(g.viewId))
                      const manageOn = !!(g.manageId && selected.has(g.manageId))
                      return (
                        <div
                          key={g.raw_name}
                          className={cn(
                            'flex items-start gap-3 px-3 py-2 transition-colors',
                            isSystem ? 'opacity-90' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-slate-900 dark:text-white">
                                {g.title}
                              </span>
                              {g.sub_level && (
                                <Badge variant="secondary" className="text-xxs uppercase tracking-wider px-1.5 py-0.5">
                                  {humanizeSubLevel(g.sub_level, g.level)}
                                </Badge>
                              )}
                            </div>
                            {g.description && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                {g.description}
                              </p>
                            )}
                            <p className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                              {g.raw_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                            {g.viewId && (
                              <button
                                type="button"
                                role="switch"
                                aria-checked={viewOn}
                                aria-label={`${viewOn ? 'Revoke' : 'Grant'} view permission for ${g.title}`}
                                disabled={isSystem}
                                onClick={() => toggleView(g)}
                                className={cn(
                                  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer active:scale-[0.97]',
                                  viewOn
                                    ? 'bg-sky-500 dark:bg-sky-500 text-white border-sky-500 dark:border-sky-500 shadow-sm hover:bg-sky-600 dark:hover:bg-sky-400'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-sky-400 dark:hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-950/30',
                                )}
                              >
                                {viewOn ? (
                                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                ) : (
                                  <span className="h-3.5 w-3.5 rounded border border-current opacity-60" />
                                )}
                                View
                              </button>
                            )}
                            {g.manageId && (
                              <button
                                type="button"
                                role="switch"
                                aria-checked={manageOn}
                                aria-label={`${manageOn ? 'Revoke' : 'Grant'} manage permission for ${g.title}`}
                                disabled={isSystem}
                                onClick={() => toggleManage(g)}
                                className={cn(
                                  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer active:scale-[0.97]',
                                  manageOn
                                    ? 'bg-indigo-500 dark:bg-indigo-500 text-white border-indigo-500 dark:border-indigo-500 shadow-sm hover:bg-indigo-600 dark:hover:bg-indigo-400'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30',
                                )}
                              >
                                {manageOn ? (
                                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                ) : (
                                  <span className="h-3.5 w-3.5 rounded border border-current opacity-60" />
                                )}
                                Manage
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  )}
                </div>
              )
            })}
          </div>
          {isSystem && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 inline-flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              System role permissions cannot be changed.
            </p>
          )}
        </div>
      </form>
    </ConfirmDialog>
  )
}

function RoleViewerDialog({ role, onOpenChange }) {
  if (!role) return null
  const grouped = (role.permissions || []).reduce((acc, name) => {
    const perm = PERMISSIONS.find((p) => p.name === name)
    if (!perm) return acc
    if (!acc[perm.level]) acc[perm.level] = []
    acc[perm.level].push(perm)
    return acc
  }, {})
  return (
    <ConfirmDialog
      open={!!role}
      onOpenChange={onOpenChange}
      title={`${role.title} — permissions`}
      confirmLabel="Close"
      onConfirm={() => onOpenChange(false)}
      size="lg"
      className="max-w-2xl"
    >
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        {role.description && (
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{role.description}</p>
        )}
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-mono">
          {role.name} · {(role.permissions || []).length} permissions
        </div>
        {Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No permissions assigned.</p>
        ) : (
          <div className="space-y-3">
            {Object.keys(PERMISSION_LEVELS).map((levelKey) => {
              const perms = grouped[levelKey]
              if (!perms || perms.length === 0) return null
              const LevelIcon = LEVEL_ICONS[levelKey] || ShieldCheck
              const accent = LEVEL_ACCENTS[levelKey] || 'slate'
              return (
                <div key={levelKey}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <LevelIcon className={cn(
                      'h-4 w-4',
                      accent === 'indigo'  && 'text-indigo-600 dark:text-indigo-400',
                      accent === 'violet'  && 'text-violet-600 dark:text-violet-400',
                      accent === 'emerald' && 'text-emerald-600 dark:text-emerald-400',
                    )} />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {PERMISSION_LEVELS[levelKey].label}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {perms.length}
                    </span>
                  </div>
                  <ul className="space-y-1 pl-6">
                    {perms.map((p) => (
                      <li key={p.name} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">✓</span>
                        <span>
                          {p.title}
                          <span className="ml-1.5 text-slate-400 dark:text-slate-500 font-mono">{p.name}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ConfirmDialog>
  )
}

function RoleSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-full mt-4" />
          <Skeleton className="h-4 w-3/4 mt-2" />
          <div className="mt-4 flex items-center gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </Card>
      ))}
    </div>
  )
}