'use client'

import { BillingHeaderTabs } from '@/components/billing/BillingHeaderTabs'
import { TrialStickyBar } from '@/components/billing/TrialStickyBar'

// /billing layout — adds a persistent sub-tab bar (Overview / Plans /
// Lifetime / Invoices / Settings) above the page content. When the
// active org is in active trial, a sticky TrialStickyBar appears
// between the tabs and the page content showing days remaining and a
// CTA to /billing/plans. The bar is hidden on /billing/overview since
// the Overview hero block already shows the same trial info in detail.
//
// The outer (authenticated) layout already wraps children in
// ProtectedLayout, which provides the AppShell + sidebar. Wrapping
// again would render a second AppShell (visible as duplicate sidebar
// on top of itself).
//
// Per-page owner check is handled inside each page via RestrictedAccess
// so non-owner members still see this chrome but get the gated card.
export default function BillingLayout({ children }) {
  return (
    <div className="flex flex-col h-full">
      <BillingHeaderTabs />
      <TrialStickyBar />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}