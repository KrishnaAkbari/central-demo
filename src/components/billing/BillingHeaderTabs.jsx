'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// BillingHeaderTabs — sub-tab bar for the /billing section. Sits above
// the page content in the layout. Tabs are grouped by purpose, not by
// data type, so users always know which tab to click for which job:
//
//   Overview       → current state + next action (1 screen)
//   Plans          → recurring plan picker
//   Lifetime       → one-time / lifetime deals
//   Wallet         → balance + add credit (top-level)
//   Invoices       → transaction history + downloads
//   Auto Recharge  → auto-reload rules + payment-method sub-page
//   Settings       → billing profile (rarely visited)
//
// After the IA redesign (Round 30), Wallet / Auto Recharge / Payment
// Methods are top-level destinations instead of sub-tabs under Settings.
// This matches the pattern used by Hostinger / cPanel / hosting.com —
// financial controls are not buried inside a "Settings" parent.
//
// Sticky to keep the active sub-section obvious while scrolling.
const TABS = [
  { label: 'Overview',      href: '/billing/overview' },
  { label: 'Plans',         href: '/billing/plans' },
  { label: 'Lifetime',      href: '/billing/lifetime' },
  { label: 'Wallet',        href: '/billing/wallet' },
  { label: 'Invoices',      href: '/billing/transactions' },
  { label: 'Auto Recharge', href: '/billing/auto-recharge', prefix: true },
  { label: 'Settings',      href: '/billing/settings', prefix: true },
]

export function BillingHeaderTabs() {
  const pathname = usePathname() || '/billing/overview'

  return (
    <div className="sticky top-0 z-10 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
      <div className="px-4 sm:px-6">
        <nav className="flex flex-wrap gap-x-1 gap-y-0 -mb-px" aria-label="Billing sections">
          {TABS.map((t) => {
            // For tabs with prefix:true (Settings), also highlight
            // when pathname starts with the href + '/'. This keeps the
            // parent Settings tab active when the user is on any of
            // its sub-tabs (profile / wallet / auto-recharge).
            const active = t.prefix
              ? pathname === t.href || pathname.startsWith(t.href + '/')
              : pathname === t.href || pathname.startsWith(t.href + '/')
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  'shrink-0 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  active
                    ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
                    : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700',
                )}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}