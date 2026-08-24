'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreVertical, Pencil, PlugZap, ExternalLink } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { showToast } from '@/utils/toast-utils'

import { useCan } from '@/hooks/useCan'
import * as api from '@/services/centralApi'
import { RenameServerDialog } from '@/components/servers/RenameServerDialog'

/**
 * ServerActionsMenu — kebab trigger + popover for per-server actions.
 * Mirrors the AccountActionsMenu pattern from the integrations page.
 *
 * Items:
 *   - View details  → /servers/{id}  (link, always)
 *   - Rename        → opens RenameServerDialog
 *   - Disconnect    → opens ConfirmDialog, calls api.disconnectServer
 *
 * Rename + Disconnect require `server.manage`. View details is always shown.
 */
export function ServerActionsMenu({ server }) {
  const router = useRouter()
  const canManage = useCan('organization.servers.manage')
  const [renameOpen, setRenameOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const onDisconnect = async () => {
    if (!server) return
    setBusy(true)
    try {
      await api.disconnectServer(server.id)
      showToast.success(`Disconnected ${server.name}`)
      router.push('/servers')
    } catch (err) {
      showToast.error(err?.message || 'Failed to disconnect')
    } finally {
      setBusy(false)
      setDisconnectOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${server?.name || 'server'}`}
          className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          onClick={(e) => e.preventDefault()}
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="min-w-44">
          <DropdownMenuItem render={<Link href={`/servers/${server.id}`} />} inset>
            View details
          </DropdownMenuItem>
          {server.panelUrl && (
            <DropdownMenuItem
              render={
                <a
                  href={`${server.panelUrl}#services`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLink className="h-4 w-4" /> Services
            </DropdownMenuItem>
          )}
          {server.panelUrl && (
            <DropdownMenuItem
              render={
                <a
                  href={server.panelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLink className="h-4 w-4" /> Open Source
            </DropdownMenuItem>
          )}
          {canManage && (
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <Pencil className="h-4 w-4" /> Rename
            </DropdownMenuItem>
          )}
          {canManage && (
            <DropdownMenuItem
              onClick={() => setDisconnectOpen(true)}
              variant="destructive"
            >
              <PlugZap className="h-4 w-4" /> Disconnect
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canManage && (
        <RenameServerDialog
          open={renameOpen}
          onOpenChange={setRenameOpen}
          server={server}
        />
      )}

      {canManage && (
        <ConfirmDialog
          open={disconnectOpen}
          onOpenChange={setDisconnectOpen}
          title="Disconnect server?"
          description={
            <>
              <span className="font-semibold text-slate-900 dark:text-white">{server?.name}</span>{' '}
              will be removed from Central Panel. The actual VPS keeps running — you can
              reconnect it any time by pasting its Server Management Key again.
            </>
          }
          confirmText="Disconnect"
          variant="destructive"
          loading={busy}
          onConfirm={onDisconnect}
        />
      )}
    </>
  )
}