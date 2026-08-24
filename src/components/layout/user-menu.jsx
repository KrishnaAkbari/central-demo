'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, User as UserIcon } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore } from '@/stores/authStore'
import { showToast } from '@/utils/toast-utils'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

// Avatar-and-popover menu anchored to the header avatar. Uses the project
// shared `src/components/ui/menu` wrapper around @base-ui/react/menu, which
// handles click-outside, Escape, focus trapping, keyboard navigation, and
// ARIA roles + states automatically.
export function UserMenu({ user }) {
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)

  const onLogout = async () => {
    try {
      await logout()
      showToast.success('Signed out')
      router.replace('/login')
    } catch (err) {
      showToast.error(err?.message || 'Failed to sign out')
    }
  }

  const onOpenChange = (open) => {
    if (!open) return
  }

  const initial = (user?.name || user?.email || '?').slice(0, 1).toUpperCase()

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Avatar className="h-9 w-9 rounded-full hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50">
          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-700 text-white font-semibold">
            {initial}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-56">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {user?.name || user?.username || 'Account'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {user?.email}
          </p>
        </div>
        <DropdownMenuItem
          render={<Link href="/profile" />}
          inset
        >
          <UserIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          variant="destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
