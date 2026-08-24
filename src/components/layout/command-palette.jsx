'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Server as ServerIcon, Users as UsersIcon,
  ShieldCheck, History, Cloud, Building2, UserCircle, Plus,
  KeyRound, LogOut, ArrowRightLeft, Search as SearchIcon,
  CreditCard, CornerDownLeft, ArrowUp, ArrowDown, X,
} from 'lucide-react'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/utils'
import { useCan } from '@/hooks/useCan'
import { useAuthStore } from '@/stores/authStore'
import { useOrganizationStore } from '@/stores/organizationStore'
import * as api from '@/services/centralApi'
import { showToast } from '@/utils/toast-utils'

const RECENT_KEY = 'cp_cmdk_recent'
const RECENT_MAX = 5

// fuzzyScore — returns 0 if no match, otherwise a score where higher is
// better. Two tiers:
//   1. exact substring match in title or keywords (strongest signal) —
//      gets 500–1000 with bonus when the match starts the title or a
//      keyword (so "dash" outranks anything containing "dash" mid-word).
//   2. subsequence match — query chars appear in the haystack in order,
//      possibly with gaps. Catches typos like "dashbrd" → "Dashboard"
//      or "provdr" → "Providers". Base 200 + bonuses for consecutive
//      runs (each +10) and word-starts (each +5). Sorted by score desc
//      so the best match surfaces even when both tiers return hits.
function fuzzyScore(query, title, keywords) {
  const q = query.toLowerCase()
  const titleLower = title.toLowerCase()
  const kwLower = (keywords || []).map((k) => k.toLowerCase())
  const haystack = `${titleLower} ${kwLower.join(' ')}`

  // Tier 1: exact substring
  if (haystack.includes(q)) {
    if (titleLower.startsWith(q)) return 1000
    if (kwLower.some((k) => k.startsWith(q))) return 800
    return 500
  }

  // Tier 2: subsequence match
  let qi = 0
  let score = 0
  let prev = -1
  for (let i = 0; i < haystack.length && qi < q.length; i++) {
    if (haystack[i] === q[qi]) {
      if (prev === i - 1) score += 10
      if (i === 0 || haystack[i - 1] === ' ') score += 5
      prev = i
      qi++
    }
  }
  return qi === q.length ? 200 + score : 0
}

// COMMAND_ITEMS — every searchable action or navigation. Items with
// `requiresPermission` are filtered out at render time. Items with
// `href` navigate on select; items with `onSelect` run a custom action.
// `category` groups them in the list.
const COMMAND_ITEMS = [
  // Navigation
  { id: 'nav.dashboard',   title: 'Dashboard',         category: 'navigation', icon: LayoutDashboard, href: '/dashboard',       keywords: ['home', 'overview'] },
  { id: 'nav.servers',     title: 'Servers',           category: 'navigation', icon: ServerIcon,      href: '/servers',         keywords: ['list', 'machines', 'vps'] },
  { id: 'nav.members',     title: 'Members',           category: 'navigation', icon: UsersIcon,       href: '/members' },
  { id: 'nav.roles',       title: 'Roles',             category: 'navigation', icon: ShieldCheck,     href: '/roles' },
  { id: 'nav.providers',   title: 'Providers',         category: 'navigation', icon: Cloud,           href: '/integrations',    keywords: ['cloud', 'integrations', 'vultr', 'digitalocean', 'linode', 'hetzner'] },
  { id: 'nav.audit',       title: 'Audit log',         category: 'navigation', icon: History,         href: '/audit',           keywords: ['activity', 'events', 'history'] },
  { id: 'nav.orgs',        title: 'Organizations',     category: 'navigation', icon: Building2,       href: '/organizations',   keywords: ['orgs', 'teams', 'workspaces'] },
  { id: 'nav.billing',     title: 'Billing',           category: 'navigation', icon: CreditCard,      href: '/billing/overview', keywords: ['plans', 'wallet', 'invoices', 'payment', 'subscription'] },
  { id: 'nav.profile',     title: 'Profile',           category: 'navigation', icon: UserCircle,      href: '/profile',         keywords: ['account', 'settings'] },

  // Actions (permission-gated)
  { id: 'act.create-server',   title: 'Create server',          category: 'action', icon: Plus,     href: '/servers/add/create',    requiresPermission: 'organization.servers.manage', keywords: ['new', 'add', 'wizard', 'vps'] },
  { id: 'act.connect-server', title: 'Connect existing server',category: 'action', icon: KeyRound, href: '/servers/add/connect',    requiresPermission: 'organization.servers.manage', keywords: ['paste', 'key', 'existing'] },
  { id: 'act.connect-provider',title: 'Connect a provider',     category: 'action', icon: Cloud,    href: '/integrations',           requiresPermission: 'organization.servers.manage', keywords: ['cloud', 'token', 'add'] },
  { id: 'act.switch-org',      title: 'Switch organization',    category: 'action', icon: ArrowRightLeft, onSelect: 'switch-org',        keywords: ['org', 'team', 'workspace'] },
  { id: 'act.sign-out',        title: 'Sign out',               category: 'action', icon: LogOut,   onSelect: 'sign-out',            keywords: ['logout', 'exit'] },
]

export function CommandPalette({ open, onOpenChange }) {
  const router = useRouter()
  const canManage = useCan('organization.servers.manage')
  const logout = useAuthStore((s) => s.logout)
  const orgs = useOrganizationStore((s) => s.organizations)
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recent, setRecent] = useState([])

  // Load recents when palette opens, clear query + reset cursor each open
  useEffect(() => {
    if (!open) return
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(RECENT_KEY) : null
      setRecent(raw ? JSON.parse(raw) : [])
    } catch {
      setRecent([])
    }
    setQuery('')
    setActiveIndex(0)
    // small delay so input mounts before focus
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  const filtered = useMemo(() => {
    const allowed = COMMAND_ITEMS.filter((it) => !it.requiresPermission || (it.requiresPermission === 'organization.servers.manage' && canManage))
    const q = query.trim().toLowerCase()
    if (!q) {
      // Empty query: show Recent (if any) + all allowed
      const recentItems = recent
        .map((id) => allowed.find((it) => it.id === id))
        .filter(Boolean)
      const rest = allowed.filter((it) => !recent.includes(it.id))
      return {
        groups: [
          ...(recentItems.length ? [{ heading: 'Recent', items: recentItems }] : []),
          { heading: 'All', items: rest },
        ],
        flat: [...recentItems, ...rest],
      }
    }
    const matched = allowed
      .map((it) => ({ item: it, score: fuzzyScore(q, it.title, it.keywords) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item)
    // Group matched items by category so the results pane mirrors the
    // empty-query "Recent / All" structure. Each heading only renders
    // when it has at least one match, so a query like "create" shows
    // just "Actions" while "audit" shows just "Navigation".
    const navigation = matched.filter((it) => it.category === 'navigation')
    const actions    = matched.filter((it) => it.category === 'action')
    const groups = []
    if (navigation.length) groups.push({ heading: 'Navigation', items: navigation })
    if (actions.length)    groups.push({ heading: 'Actions',    items: actions    })
    return { groups, flat: matched }
  }, [query, canManage, recent])

  // Keep activeIndex in bounds when filter changes
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const close = () => onOpenChange(false)

  const persistRecent = (id) => {
    try {
      const next = [id, ...recent.filter((r) => r !== id)].slice(0, RECENT_MAX)
      setRecent(next)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      /* noop */
    }
  }

  // Remove a single item from recents. Adjusts activeIndex so the cursor
  // doesn't end up on a stale row: items after the removed one shift down
  // by one, and if the cursor was ON the removed row, it stays put
  // (now pointing at the next item) — unless it was the last row, in
  // which case it falls back to the previous item.
  const removeRecent = (id) => {
    const oldFlat = filtered.flat
    const flatIdx = oldFlat.findIndex((it) => it.id === id)
    const next = recent.filter((r) => r !== id)
    setRecent(next)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* noop */ }
    if (flatIdx === -1) return
    if (activeIndex > flatIdx) {
      setActiveIndex(activeIndex - 1)
    } else if (activeIndex === flatIdx && flatIdx >= oldFlat.length - 1) {
      setActiveIndex(Math.max(0, flatIdx - 1))
    }
  }

  // Wipe all recents. The Recent group disappears and every subsequent
  // item shifts up by oldRecentCount. Cursor lands on the same relative
  // row when possible; clamps to 0 when the cursor was inside the
  // removed group.
  const clearAllRecents = () => {
    const oldRecentCount = recent.length
    setRecent([])
    try { localStorage.removeItem(RECENT_KEY) } catch { /* noop */ }
    if (activeIndex < oldRecentCount) {
      setActiveIndex(0)
    } else {
      setActiveIndex(Math.max(0, activeIndex - oldRecentCount))
    }
  }

  const runItem = async (item) => {
    close()
    if (item.href) {
      persistRecent(item.id)
      router.push(item.href)
      return
    }
    if (item.onSelect === 'sign-out') {
      try {
        await logout()
        showToast.success('Signed out')
        router.replace('/login')
      } catch (err) {
        showToast.error(err?.message || 'Failed to sign out')
      }
      return
    }
    if (item.onSelect === 'switch-org') {
      // Visible hint: route to organizations page where the switcher also lives
      router.push('/organizations')
      return
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.flat.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered.flat[activeIndex]
      if (item) runItem(item)
    }
    // Escape handled by Dialog primitive
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        showCloseButton={false}
        className="max-w-2xl p-0 overflow-hidden"
        style={{
          top: '10vh',
          left: '50%',
          transform: 'translateX(-50%)',
          borderRadius: '15px',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-700">
          <SearchIcon className="h-5 w-5 text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent outline-none text-base text-slate-900 dark:text-white placeholder:text-slate-400"
            data-testid="cmdk-input"
            aria-label="Command search"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 text-xxs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain py-2" data-testid="cmdk-results">
          {filtered.flat.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No results for <span className="font-semibold text-slate-700 dark:text-slate-200">"{query}"</span>
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Try searching for "Dashboard", "Create server", or "Audit log"
              </p>
            </div>
          ) : (
            filtered.groups.map((group, gi) => {
              const isRecentGroup = group.heading === 'Recent'
              return (
                <div key={group.heading} className={gi > 0 ? 'mt-2 pt-2 border-t border-slate-100 dark:border-slate-800' : ''}>
                  {group.heading && (
                    <div className="flex items-center justify-between px-4 pt-2 pb-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {group.heading}
                      </p>
                      {isRecentGroup && (
                        <button
                          type="button"
                          onClick={clearAllRecents}
                          className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                          data-testid="cmdk-clear-recents"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                  <ul>
                    {group.items.map((item) => {
                      const flatIdx = filtered.flat.findIndex((it) => it.id === item.id)
                      const active = flatIdx === activeIndex
                      const Icon = item.icon
                      return (
                        <li key={item.id} className="relative group">
                          <button
                            type="button"
                            onClick={() => runItem(item)}
                            onMouseEnter={() => setActiveIndex(flatIdx)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              active
                                ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-200'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-800/50',
                            )}
                            data-testid={`cmdk-item-${item.id}`}
                          >
                            <span className={cn(
                              'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                              active
                                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
                            )}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium truncate">{item.title}</span>
                            </span>
                            <span className={cn(
                              'text-xxs uppercase tracking-wider font-semibold hidden sm:inline',
                              active ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500',
                            )}>
                              {item.category}
                            </span>
                          </button>
                          {isRecentGroup && (
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation()
                                removeRecent(item.id)
                              }}
                              aria-label={`Remove ${item.title} from recents`}
                              data-testid={`cmdk-remove-recent-${item.id}`}
                              className={cn(
                                'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity',
                                active
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                              )}
                            >
                              <X className="h-3.5 w-3.5 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400" />
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-3 text-xxs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Kbd><ArrowUp className="h-2.5 w-2.5" /></Kbd>
              <Kbd><ArrowDown className="h-2.5 w-2.5" /></Kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd><CornerDownLeft className="h-2.5 w-2.5" /></Kbd>
              select
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>esc</Kbd>
              close
            </span>
          </div>
          <span className="text-xxs text-slate-400 dark:text-slate-500 hidden sm:inline">
            {orgs?.length > 1 ? `${orgs.length} orgs available` : 'Central Panel'}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
      {children}
    </kbd>
  )
}
