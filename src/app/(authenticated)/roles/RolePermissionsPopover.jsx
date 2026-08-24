'use client'

import { useState, useMemo } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Search } from 'lucide-react'
import { getPermissionById } from '@/lib/permissions'
import { Badge } from '@/components/ui/badge'

// Popover showing the full list of permissions assigned to a role.
// Mirrors OSP's RolePermissionsPopover shape but uses Base UI's Popover
// (Central Panel has @base-ui/react in its package.json but no Radix).
//
// Trigger is provided by the parent. Body is searchable and groups
// permissions by level for quick scanning.
export function RolePermissionsPopover({ permissionIds = [], triggerLabel, children }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const all = useMemo(() => {
    return permissionIds
      .map((id) => getPermissionById(id))
      .filter(Boolean)
  }, [permissionIds])

  const grouped = useMemo(() => {
    const filtered = query.trim()
      ? all.filter((p) =>
          (p.title || p.name || '').toLowerCase().includes(query.toLowerCase()) ||
          (p.action || '').toLowerCase().includes(query.toLowerCase())
        )
      : all

    const acc = {}
    for (const p of filtered) {
      const key = p.level || 'other'
      if (!acc[key]) acc[key] = []
      acc[key].push(p)
    }
    Object.values(acc).forEach((arr) => arr.sort((a, b) => (a.order_by || 0) - (b.order_by || 0)))
    return acc
  }, [all, query])

  return (
    <Popover.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery('') }}>
      <Popover.Trigger render={children || (
        <button
          type="button"
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          title="Show all permissions"
        >
          {triggerLabel || 'View all'}
        </button>
      )} />
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start">
          <Popover.Popup
            className="z-50 w-[420px] max-w-[90vw] p-0 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">All permissions</p>
                <span className="text-xs text-slate-500 dark:text-slate-400">{all.length} total</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                <input
                  autoFocus
                  placeholder="Filter permissions..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 h-8 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {Object.keys(grouped).length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">No permissions match</p>
              ) : (
                Object.entries(grouped).map(([group, perms]) => (
                  <div key={group} className="mb-2 last:mb-0">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 mb-1">
                      {group.replace(/_/g, ' ')}
                    </p>
                    <ul className="space-y-0.5">
                      {perms.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-700/50"
                        >
                          <span className="text-xs text-slate-800 dark:text-slate-200 truncate">
                            {p.title || p.name}
                          </span>
                          <Badge variant={p.action === 'manage' ? 'indigo' : 'secondary'} className="text-xxs rounded">
                            {p.action}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}