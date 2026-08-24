'use client'

import { Fragment, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  Server as ServerIcon,
  Users as UsersIcon,
  ShieldCheck,
  Building2,
  History,
  CreditCard,
  LayoutTemplate,
  ChevronLeft,
  ChevronRight,
  Menu,
  Sun,
  Moon,
  Monitor,
  Bell,
  Search as SearchIcon,
  Inbox,
  Check,
} from 'lucide-react'

import { useAuthStore } from '@/stores/authStore'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useBlueprintsStore } from '@/stores/blueprintsStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { UserMenu } from '@/components/layout/user-menu'
import { OrganizationSwitcher } from '@/components/organizations/OrganizationSwitcher'
import { useInvitesCount } from '@/hooks/useInvitesCount'
import { useSidebarCounts } from '@/hooks/useSidebarCounts'
import { cn } from '@/utils'
import { useCommandPalette } from '@/components/layout/use-command-palette'
import { CommandPalette } from '@/components/layout/command-palette'

// Sidebar groups. Members and Audit log are Organization-scoped via the
// active-Organization store. The Organization switcher sits in the header
// and drives every page; Organization management lives at /organizations
// (reached from the switcher). Profile lives in the user-menu popover.
const primaryNav = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: ServerIcon, label: 'Servers', href: '/servers' },
]

const accessNav = [
  { icon: Building2, label: 'Organizations', href: '/organizations', countKey: 'orgsTotal' },
  { icon: ShieldCheck, label: 'Roles', href: '/roles' },
  { icon: UsersIcon, label: 'Members', href: '/members', countKey: 'membersTotal' },
]

// Billing section — scoped to active Org, owner-only writes. The Overview
// page is the main landing; sub-pages cover Plans, Lifetime, Wallet,
// Transactions, Billing Details, Auto Recharge.
const billingNav = [
  { icon: CreditCard, label: 'Billing', href: '/billing' },
]

const systemNav = [
  { icon: ServerIcon, label: 'Providers', href: '/integrations' },
  { icon: History, label: 'Audit log', href: '/audit' },
]

// WordPress section — reusable blueprints used when creating a WP application.
// This is the primary landing for the WP Blueprints feature; the actual
// application-creation flow (which consumes a blueprint) is a future page.
const wordpressNav = [
  { icon: LayoutTemplate, label: 'Blueprints', href: '/blueprints' },
]

// Map a URL segment to a human label for the breadcrumb. Falls back to
// the segment itself (capitalised) when no mapping is known.
const SEGMENT_LABELS = {
  dashboard: 'Dashboard',
  servers: 'Servers',
  add: 'Add',
  create: 'Create',
  connect: 'Connect',
  members: 'Members',
  roles: 'Roles',
  organizations: 'Organizations',
  integrations: 'Providers',
  audit: 'Audit log',
  profile: 'Profile',
  teams: 'Teams',
  settings: 'Settings',
  billing: 'Billing',
  overview: 'Overview',
  plans: 'Plans',
  lifetime: 'Lifetime Deals',
  wallet: 'Wallet',
  transactions: 'Transactions',
  details: 'Billing Details',
  'auto-recharge': 'Auto Recharge',
}
const labelFor = (segment) =>
  SEGMENT_LABELS[segment] ||
  segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')

// Build a breadcrumb chain from the current pathname. The first crumb
// is always "Central Panel" pointing to /dashboard.
function useBreadcrumb() {
  const pathname = usePathname() || '/'
  const segments = pathname.split('/').filter(Boolean)
  // Snapshot the blueprints list (non-reactive) so we can substitute friendly
  // names for blueprint IDs in the breadcrumb. getState() reads the current
  // value without subscribing; the breadcrumb re-renders with the page anyway.
  const blueprints = useBlueprintsStore.getState().blueprints || []
  const crumbs = [{ label: 'Central Panel', href: '/dashboard' }]
  let acc = ''
  for (const seg of segments) {
    acc += '/' + seg
    // Skip the segment whose href collides with the first crumb's href
    // (i.e., when the user is already on /dashboard). Without this guard
    // we'd render two crumbs with the same key and trip the duplicate-key
    // warning. Hrefs are unique to one segment of the URL anyway.
    if (crumbs.some((c) => c.href === acc)) continue
    let label = labelFor(seg)
    // If the previous crumb is "Blueprints", this segment is a blueprint ID —
    // substitute its friendly name from the store.
    const prev = crumbs[crumbs.length - 1]
    if (prev && prev.label === 'Blueprints') {
      const bp = blueprints.find((b) => b.id === seg)
      if (bp) label = bp.name
    }
    crumbs.push({ label, href: acc })
  }
  return crumbs
}

const SIDEBAR_STORAGE_KEY = 'centralPanel.sidebarCollapsed'

export function CentralShell({ children }) {
  const user = useAuthStore((s) => s.user)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const pathname = usePathname()
  const cmd = useCommandPalette()
  const crumbs = useBreadcrumb()

  // Load persisted sidebar collapse state on first mount. Returns the
  // SSR placeholder width (w-72) until hydrated so the first paint
  // matches the server-rendered shell.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY)
      if (saved != null) {
        setDesktopSidebarOpen(saved !== 'true')
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Responsive: viewport always drives sidebar state at >=1024px wide.
  // The persisted toggle above only seeds the initial state. Any
  // viewport change resets the sidebar to the viewport-appropriate
  // value, so the page stays responsive across resizes and not just
  // on the first paint.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 1024px)')
    const apply = () => setDesktopSidebarOpen(mql.matches)
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [])

  const toggleDesktopSidebar = () => {
    setDesktopSidebarOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!next))
      } catch {}
      return next
    })
  }

  // Live counts for sidebar badge slots.
  const pendingInvites = useInvitesCount()
  const { membersTotal, orgsTotal } = useSidebarCounts()
  const counts = {
    ...(membersTotal != null && { membersTotal }),
    ...(orgsTotal != null && { orgsTotal }),
  }
  const badges = {
    ...(pendingInvites > 0 && { pendingInvites }),
  }

  // Ensure the Organization store is hydrated the moment any authenticated
  // page renders.
  const hydrateOrgs = useOrganizationStore((s) => s.hydrate)
  useEffect(() => {
    hydrateOrgs()
  }, [hydrateOrgs])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-transparent">
      {/* Desktop sidebar — only renders at >= sm (640px). */}
      {hydrated && (
        <div className={cn('hidden sm:block shrink-0 transition-[width] duration-300 ease-in-out', desktopSidebarOpen ? 'w-72' : 'w-20')}>
          <CentralSidebar
            isOpen={desktopSidebarOpen}
            onToggle={toggleDesktopSidebar}
            badges={badges}
            counts={counts}
          />
        </div>
      )}
      {!hydrated && (
        <div className="hidden sm:block w-72 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800" />
      )}

      {/* Mobile drawer — uses shadcn Sheet (proper focus trap, escape,
          portal, click-outside, slide animation). */}
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent side="left" className="w-72 max-w-[85vw] p-0 gap-0 sm:max-w-sm">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetBody
            isOpen={true}
            badges={badges}
            counts={counts}
            pathname={pathname}
            onNavigate={() => setMobileSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-4 sm:px-6 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 supports-[backdrop-filter]:dark:bg-slate-900/60 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile-only: opens the sheet drawer */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden shrink-0"
              onClick={() => setMobileSheetOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            {/* Desktop-only: toggles desktop sidebar collapse */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex shrink-0"
              onClick={toggleDesktopSidebar}
              aria-label="Toggle sidebar"
            >
              {desktopSidebarOpen ? (
                <ChevronLeft className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </Button>
            <Breadcrumb className="hidden min-w-0 lg:flex">
              <BreadcrumbList>
                {crumbs.map((c, i) => {
                  const isLast = i === crumbs.length - 1
                  const isCollapseable = !isLast && i !== 0
                  return (
                    <Fragment key={c.href}>
                      {i > 0 && (
                        <BreadcrumbSeparator
                          className={cn(
                            'flex h-5 items-center justify-center',
                            isCollapseable ? 'hidden lg:block' : undefined,
                          )}
                        />
                      )}
                      <BreadcrumbItem className={cn('min-w-0 inline-flex items-center h-5', isCollapseable && 'hidden lg:flex')}>
                        {isLast ? (
                          <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link href={c.href} className="truncate">{c.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
            {/* Tablet-only stripped breadcrumb: home + current page, no
                middle segments, so the header row never overflows against
                the right-side icons at sm-to-lg widths. */}
            <Breadcrumb className="hidden min-w-0 sm:flex lg:hidden">
              <BreadcrumbList>
                {crumbs.length > 1 && (
                  <span className="flex items-center gap-1.5 min-w-0">
                    {crumbs[0] && (
                      <BreadcrumbItem className="min-w-0 inline-flex items-center h-5">
                        <BreadcrumbLink asChild>
                          <Link href={crumbs[0].href} className="truncate text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                            {crumbs[0].label}
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                    )}
                    <BreadcrumbSeparator />
                    <BreadcrumbItem className="min-w-0">
                      <BreadcrumbPage className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {crumbs[crumbs.length - 1]?.label}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </span>
                )}
              </BreadcrumbList>
            </Breadcrumb>
            {/* Mobile-only page title — the breadcrumb is hidden on
                phones; show the last crumb as the page title instead. */}
            <span className="sm:hidden text-sm font-semibold text-slate-900 dark:text-white truncate">
              {crumbs[crumbs.length - 1]?.label || 'Central Panel'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {/* Organization switcher: full label on lg+, icon-only on md and
                below so it stops competing with the breadcrumb, bell, and
                account buttons at tablet width. */}
            <div className="hidden lg:block min-w-0">
              <OrganizationSwitcher />
            </div>
            <div className="lg:hidden shrink-0">
              <OrganizationSwitcher compact />
            </div>
            {/* Search trigger — opens the global command palette. Hidden on
                mobile (smallest viewports) because the icon button + text
                + ⌘K hint don't fit; the search is still accessible via
                ⌘K on hardware keyboards or via the mobile sheet drawer. */}
            <button
              type="button"
              onClick={cmd.toggle}
              aria-label="Open command palette"
              className={cn(
                'hidden md:inline-flex items-center gap-2 h-9 pl-2.5 pr-2 rounded-lg',
                'text-sm text-slate-500 dark:text-slate-400',
                'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
                'hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white dark:hover:text-white',
                'transition-colors',
              )}
              data-testid="cmdk-trigger"
            >
              <SearchIcon className="h-4 w-4" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden lg:inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xxs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded">
                ⌘K
              </kbd>
            </button>
            <div className="hidden lg:block"><NotificationsPopover /></div>

            <div className="hidden lg:block"><ThemeToggle /></div>

            <UserMenu user={user} />
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>

      <CommandPalette open={cmd.open} onOpenChange={cmd.setOpen} />
    </div>
  )
}

// SheetBody — the sidebar content (logo + nav + footer) used by both
// the desktop sidebar and the mobile sheet drawer.
function SheetBody({ isOpen, badges, counts, pathname, onNavigate }) {
  const cmd = useCommandPalette()
  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-slate-900">
      <div className={cn('p-4 pb-4', !isOpen && 'flex justify-center')}>
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-700 shrink-0">
            <ServerIcon className="h-5 w-5 text-white" />
          </div>
          {isOpen && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-slate-900 dark:text-white">ServerAvatar</span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Central Panel
              </span>
            </div>
          )}
        </Link>
      </div>
      <div className={cn('h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent', isOpen ? 'mx-6' : 'mx-2')} />
      {onNavigate && (
        <div className="px-3 pt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => { cmd.toggle(); onNavigate?.() }}
            className="w-full inline-flex items-center gap-2 h-10 px-3 rounded-lg text-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors"
          >
            <SearchIcon className="h-4 w-4" />
            <span>Search</span>
            <kbd className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xxs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded">
              ⌘K
            </kbd>
          </button>
          <ThemeToggle variant="drawer" />
        </div>
      )}
      <nav className="flex-1 min-h-0 overflow-y-auto py-4 px-3 space-y-4">
        <NavGroup heading="" items={primaryNav} isOpen={isOpen} pathname={pathname} badges={badges} counts={counts} onNavigate={onNavigate} />
        {billingNav.length > 0 && (
          <NavGroup heading="Billing" items={billingNav} isOpen={isOpen} pathname={pathname} badges={badges} counts={counts} onNavigate={onNavigate} />
        )}
        {accessNav.length > 0 && (
          <NavGroup heading="Access" items={accessNav} isOpen={isOpen} pathname={pathname} badges={badges} counts={counts} onNavigate={onNavigate} />
        )}
        {wordpressNav.length > 0 && (
          <NavGroup heading="WordPress" items={wordpressNav} isOpen={isOpen} pathname={pathname} badges={badges} counts={counts} onNavigate={onNavigate} />
        )}
        {systemNav.length > 0 && (
          <NavGroup heading="System" items={systemNav} isOpen={isOpen} pathname={pathname} badges={badges} counts={counts} onNavigate={onNavigate} />
        )}
      </nav>
      {isOpen && process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          Central Panel — Demo
        </div>
      )}
    </div>
  )
}

function NavGroup({ heading, items, isOpen, pathname, badges, counts, onNavigate }) {
  if (!isOpen) {
    return (
      <ul className="space-y-1.5">
        {items.map((item) => (
          <NavItem key={item.href} item={item} pathname={pathname} isOpen={false} badges={badges} counts={counts} onNavigate={onNavigate} />
        ))}
      </ul>
    )
  }
  return (
    <div className="space-y-1">
      {heading && (
        <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {heading}
        </p>
      )}
      <ul className="space-y-1.5">
        {items.map((item) => (
          <NavItem key={item.href} item={item} pathname={pathname} isOpen badges={badges} counts={counts} onNavigate={onNavigate} />
        ))}
      </ul>
    </div>
  )
}

function NavItem({ item, pathname, isOpen, badges, counts, onNavigate }) {
  const Icon = item.icon
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const badge = item.badgeKey ? badges?.[item.badgeKey] : null
  const count = item.countKey ? counts?.[item.countKey] : null
  const showBadge = badge != null && badge > 0
  const showCount = count != null && !showBadge
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        title={!isOpen ? item.label : undefined}
        className={cn(
          'group flex items-center gap-3 rounded-lg transition-colors relative',
          !isOpen
            ? isActive
              ? 'justify-center w-11 h-11 rounded-xl bg-indigo-600 text-white'
              : 'justify-center w-11 h-11 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800'
            : isActive
              ? 'bg-indigo-50 border-l-[3px] border-indigo-600 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-400 dark:text-indigo-300 pl-3 pr-4 py-2.5'
              : 'text-slate-600 border-l-[3px] border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white pl-3 pr-4 py-2.5'
        )}
      >
        <Icon
          className={cn(
            'h-[18px] w-[18px] flex-shrink-0 transition-colors',
            !isOpen
              ? isActive
                ? 'text-white'
                : ''
              : isActive
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
          )}
        />
        {isOpen && (
          <span className={cn('text-sm truncate flex-1', isActive ? 'font-semibold' : 'font-medium')}>
            {item.label}
            {showCount && (
              <span className="ml-1.5 text-slate-400 dark:text-slate-500 font-normal tabular-nums">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </span>
        )}
        {isOpen && showBadge && (
          <Badge className="min-w-[1.25rem] h-5 px-1.5 text-xxs tabular-nums" variant="warning">
            {badge > 99 ? '99+' : badge}
          </Badge>
        )}
        {!isOpen && showBadge && (
          <span
            className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900 pointer-events-none"
            aria-label={`${badge} pending`}
          />
        )}
      </Link>
    </li>
  )
}

function CentralSidebar({ isOpen, onToggle, badges, counts }) {
  const pathname = usePathname()
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 bottom-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-[width] duration-300 ease-in-out overflow-hidden',
        isOpen ? 'w-72' : 'w-20'
      )}
    >
      <SheetBody isOpen={isOpen} badges={badges} counts={counts} pathname={pathname} />
      <div className="p-3">
        <div className={cn('h-px bg-slate-200 dark:bg-slate-700/50 mb-3', !isOpen && 'mx-2')} />
        <button
          onClick={onToggle}
          className="group flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white transition-colors"
          title={!isOpen ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={cn('h-5 w-5 transition-transform duration-300', !isOpen && 'rotate-180')} />
          {isOpen && <span className="hidden lg:inline text-sm font-semibold">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}

// ThemeToggle — dropdown menu anchored to a sun/moon icon button. Reads
// the current theme from next-themes and writes the user's choice back.
// The "drawer" variant is a full-width row used inside the mobile sheet
// drawer; it cycles through light/dark/system on tap (simple, no popover).
function ThemeToggle({ variant = 'icon' }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const current = theme === 'system' ? resolvedTheme : theme
  const Icon = current === 'dark' ? Moon : Sun

  if (variant === 'drawer') {
    const cycle = () => {
      const next = current === 'dark' ? 'light' : 'dark'
      setTheme(next)
    }
    return (
      <button
        type="button"
        onClick={cycle}
        className="w-full inline-flex items-center gap-2 h-10 px-3 rounded-lg text-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors"
        aria-label={`Theme: ${current === 'dark' ? 'dark' : 'light'} — tap to switch`}
      >
        <Icon className="h-4 w-4" />
        <span>{current === 'dark' ? 'Dark' : 'Light'}</span>
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {theme === 'system' ? '(system)' : ''}
        </span>
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          className="text-slate-500 dark:text-slate-400"
        >
          <Icon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-xs font-normal text-slate-500 dark:text-slate-400">
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('light')} className="cursor-pointer">
          <Sun className="h-4 w-4 mr-2" />
          Light
          {theme === 'light' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} className="cursor-pointer">
          <Moon className="h-4 w-4 mr-2" />
          Dark
          {theme === 'dark' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')} className="cursor-pointer">
          <Monitor className="h-4 w-4 mr-2" />
          System
          {theme === 'system' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// NotificationsPopover — placeholder bell-icon popover with empty state.
// Future iterations can wire this to a notifications store / SSE channel.
// The "drawer" variant is a full-width row used inside the mobile sheet
// drawer.
function NotificationsPopover({ variant = 'icon' }) {
  if (variant === 'drawer') {
    return (
      <button
        type="button"
        disabled
        className="w-full inline-flex items-center gap-2 h-10 px-3 rounded-lg text-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 opacity-70 cursor-not-allowed"
        aria-label="Notifications — none"
      >
        <Bell className="h-4 w-4" />
        <span>Notifications</span>
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">0</span>
      </button>
    )
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="text-slate-500 dark:text-slate-400 relative"
        >
          <Bell className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            You're all caught up
          </p>
        </div>
        <div className="px-4 py-10 flex flex-col items-center justify-center text-center">
          <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
            <Inbox className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">No new notifications</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[16rem]">
            Server alerts, member invites, and audit events will appear here.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}