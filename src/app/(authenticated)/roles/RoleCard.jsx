'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Pencil, Trash2, Lock } from 'lucide-react'
import { getPermissionById } from '@/lib/permissions'
import { RolePermissionsPopover } from './RolePermissionsPopover'

// Single role card. Clickable anywhere on the body to open Edit (when
// the user has role.manage permission). Pencil and trash live in the
// footer action row. System roles (Admin/Member) get a Lock badge and
// have their delete button hidden — they cannot be deleted or have
// their permission set changed (their title/description is still
// editable, mirroring OSP).
export function RoleCard({ role, canManage, onEdit, onDelete }) {
  const perms = (role.permissions || [])
    .map((id) => getPermissionById(id))
    .filter(Boolean)

  const TOP_N = 4
  const top = perms.slice(0, TOP_N)
  const remaining = perms.slice(TOP_N)

  return (
    <Card
      className="p-5 cursor-pointer transition-all hover:border-indigo-300 dark:hover:border-indigo-700"
      onClick={(e) => {
        if (e.target.closest('button, [role="button"], a, [data-base-ui-popper-content-wrapper]')) return
        if (canManage) onEdit()
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{role.title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{role.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {role.isSystem && (
            <Badge variant="warning" size="sm" className="gap-1">
              <Lock className="h-3 w-3" />
              Built-in
            </Badge>
          )}
        </div>
      </div>

      {role.description ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{role.description}</p>
      ) : (
        <p className="text-sm text-slate-400 dark:text-slate-500 mb-3 italic">No description</p>
      )}

      <div className="flex flex-wrap gap-1 mb-4 min-h-[28px]">
        {top.length === 0 ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">No permissions</span>
        ) : (
          <>
            {top.map((p) => (
              <Badge key={p.id} variant="indigo" size="sm" title={p.title || p.name}>
                {p.title || p.name}
              </Badge>
            ))}
            {remaining.length > 0 && (
              <RolePermissionsPopover
                permissionIds={role.permissions || []}
                triggerLabel={`+${remaining.length} more`}
              />
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700/50">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {perms.length} permission{perms.length === 1 ? '' : 's'}
        </span>
        {canManage && (
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:hover:text-white transition-all"
              title="Edit role"
              aria-label="Edit role"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {!role.isSystem && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 transition-all"
                title="Delete role"
                aria-label="Delete role"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}