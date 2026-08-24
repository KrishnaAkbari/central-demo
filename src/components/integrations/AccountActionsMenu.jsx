'use client'

import { MoreVertical, Pencil, PlugZap } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

/**
 * AccountActionsMenu — kebab trigger + popover menu for per-account
 * actions (Rename, Disconnect). Used both inside the provider modal
 * (legacy) and on the integrations page's account rows. Visual style
 * matches the kebab on the integrations page row: small rounded square
 * with a slate border and a MoreVertical icon.
 */
export function AccountActionsMenu({ onRename, onDisconnect, label = 'Account actions' }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-44">
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="h-4 w-4" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDisconnect}
          variant="destructive"
        >
          <PlugZap className="h-4 w-4" /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}