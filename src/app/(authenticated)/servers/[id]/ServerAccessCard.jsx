'use client'

import { useEffect, useState } from 'react'
import {
  Users as UsersIcon, UserPlus, Loader2, Crown, Eye, Wrench,
} from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { showToast } from '@/utils/toast-utils'
import { cn } from '@/utils'
import * as api from '@/services/centralApi'

import { useOrganizationStore, useIsOwner } from '@/stores/organizationStore'

import { ServerShareDialog } from '../ServerShareDialog'

// Server-detail "Shared with" card. Lives on /servers/[id]. Lists every
// user with explicit access (other than the implicit-Owner access) and
// gives the Owner a single button to share/edit access. Owner-only by
// design — `assertCanManageServerAccess` enforces this server-side.
export function ServerAccessCard({ server }) {
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  const isOwner = useIsOwner()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // { userId, permissions[] }

  const load = async () => {
    if (!server?.id) return
    setLoading(true)
    setLoadError(null)
    try {
      const r = await api.listSharedUsersForServer(server.id)
      setRows(r)
    } catch (err) {
      setLoadError(err?.message || 'Failed to load access')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [server?.id, activeOrgId])

  return (
    <>
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <UsersIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-slate-900 dark:text-white">Shared with</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              People who can manage this server.{isOwner && (
                <> As Owner you have automatic access.</>
              )}
            </p>
          </div>
          {isOwner && (
            <Button
              variant="outline"
              
              className="gap-2 shrink-0"
              onClick={() => setAddOpen(true)}
              disabled={loading}
            >
              <UserPlus className="h-4 w-4" />
              Share with someone
            </Button>
          )}
        </div>

        {loadError ? (
          <div className="px-6 py-5 text-sm text-red-700 dark:text-red-300">{loadError}</div>
        ) : loading ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 inline-block mr-2 animate-spin" />
            Loading access…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-6 text-sm text-slate-700 dark:text-slate-300">
            Not shared with anyone yet.
            {isOwner
              ? ' Use Share with someone to grant access.'
              : ' Only the Org Owner can grant server access.'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((row) => (
              <li
                key={row.userId}
                className="px-6 py-3 flex items-center gap-3"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-700 text-white text-sm font-semibold">
                    {(row.user.name || row.user.email).slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                    {row.user.name || row.user.email}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-2">
                    {row.user.email}
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="tabular-nums">
                      {row.permissions.length} permission{row.permissions.length === 1 ? '' : 's'}
                    </span>
                  </p>
                </div>
                {isOwner && (
                  <button
                    onClick={() => setEditTarget({ userId: row.userId, permissions: row.permissions, user: row.user })}
                    className="text-xs px-2.5 py-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 transition-colors"
                    aria-label={`Edit access for ${row.user.email}`}
                  >
                    Edit
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ServerShareDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o)
          if (!o) load()
        }}
        mode="add"
        serverIds={server?.id ? [server.id] : []}
        serverNames={server?.name ? [server.name] : []}
        onSuccess={load}
      />

      <ServerShareDialog
        open={!!editTarget}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null)
          load()
        }}
        mode="edit"
        serverIds={server?.id ? [server.id] : []}
        serverNames={server?.name ? [server.name] : []}
        userId={editTarget?.userId || null}
        initialPermissions={editTarget?.permissions || []}
        onSuccess={load}
      />
    </>
  )
}
