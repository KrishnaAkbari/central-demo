'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, ChevronDown, Plus, Settings2 } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { showToast } from '@/utils/toast-utils'
import { cn } from '@/lib/utils'

import { useOrganizationStore, useActiveOrganization } from '@/stores/organizationStore'
import { CreateOrganizationDialog } from '@/components/organizations/CreateOrganizationDialog'

// Header Organization switcher. Trigger shows the active Organization
// name. Popover lists every Organization the user belongs to with an
// active indicator on the current one, plus footer actions to create
// or manage Organizations.
export function OrganizationSwitcher({ compact = false }) {
  const router = useRouter()
  const organizations = useOrganizationStore((s) => s.organizations)
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  const setActive = useOrganizationStore((s) => s.setActive)
  const refresh = useOrganizationStore((s) => s.refresh)
  const activeOrg = useActiveOrganization()
  const [createOpen, setCreateOpen] = useState(false)

  // -- My role per org, mirrors the table on /organizations so the header
  //    dropdown reads the same role badges as the page rows --
  const [myRoles, setMyRoles] = useState({})
  useEffect(() => {
    if (typeof window === 'undefined') return
    const compute = () => {
      const auth = JSON.parse(localStorage.getItem('cp_auth') || 'null')
      if (!auth) { setMyRoles({}); return }
      const ms = JSON.parse(localStorage.getItem('cp_memberships') || '[]')
      const roles = JSON.parse(localStorage.getItem('cp_roles') || '[]')
      const out = {}
      for (const o of organizations) {
        const row = ms.find((m) => m.organizationId === o.id && m.userId === auth.userId)
        if (!row) { out[o.id] = null; continue }
        if (row.roleId === null) { out[o.id] = 'owner'; continue }
        const r = roles.find((r) => r.id === row.roleId)
        out[o.id] = r?.name || 'member'
      }
      setMyRoles(out)
    }
    compute()
    const onChange = (e) => { if (e.key && e.key.startsWith('cp_')) compute() }
    window.addEventListener('storage', onChange)
    return () => window.removeEventListener('storage', onChange)
  }, [organizations])

  const formatRole = (r) => {
    if (!r) return null
    const s = String(r).toLowerCase()
    return s === 'owner' ? 'Owner' : s.charAt(0).toUpperCase() + s.slice(1)
  }

  const switchTo = async (orgId) => {
    if (orgId === activeOrgId) return
    try {
      await setActive(orgId)
      showToast.success('Switched organization')
    } catch (err) {
      showToast.error(err?.message || 'Failed to switch')
    }
  }

  const onCreated = async () => {
    setCreateOpen(false)
    await refresh()
    showToast.success('Organization created')
  }

  const triggerLabel = activeOrg?.name || 'Choose organization'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={compact ? 'Switch organization' : undefined}
        title={compact ? activeOrg?.name || 'Switch organization' : undefined}
        className={`h-9 inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white dark:hover:bg-slate-700 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${compact ? 'px-2.5 gap-0 justify-center' : 'px-2 sm:px-3 gap-2 max-w-[10rem] sm:max-w-[14rem]'}`}
        >
          <Building2 className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
          {!compact && <span className="truncate flex-1 min-w-0">{triggerLabel}</span>}
          {!compact && <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="min-w-64">
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Organizations
            </p>
          </div>
          {organizations.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No organizations yet.
            </div>
          ) : (
            <DropdownMenuRadioGroup value={activeOrgId || ''} onValueChange={(v) => switchTo(v)}>
              {organizations.map((o) => {
                const role = myRoles[o.id]
                const roleLabel = formatRole(role)
                return (
                  <DropdownMenuRadioItem key={o.id} value={o.id} className="!pr-3">
                    <span className="flex-1 min-w-0 truncate">{o.name}</span>
                    {roleLabel && (
                      <span
                        className={cn(
                          'ml-2 shrink-0 text-xs font-semibold uppercase tracking-wider whitespace-nowrap',
                          role === 'owner'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-slate-500 dark:text-slate-400'
                        )}
                      >
                        {roleLabel}
                      </span>
                    )}
                  </DropdownMenuRadioItem>
                )
              })}
            </DropdownMenuRadioGroup>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setCreateOpen(true)}
            className="text-indigo-600 dark:text-indigo-400"
          >
            <Plus className="h-4 w-4" />
            Create organization
          </DropdownMenuItem>
            <DropdownMenuItem
            onClick={() => router.push('/organizations')}
            render={<Link href="/organizations" />}
            inset
          >
            <Settings2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            Manage organizations
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onCreated}
      />
    </>
  )
}