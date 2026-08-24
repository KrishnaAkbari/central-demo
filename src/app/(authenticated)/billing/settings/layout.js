// /billing/settings layout — Profile only.
//
// After Round 30 IA redesign, Wallet / Auto Recharge / Payment Methods
// were promoted to top-level billing tabs. Settings now only contains
// the Profile sub-page (billing details — name, address, tax ID).
// Users land here rarely, so no second-level nav is needed: just
// the chrome from the parent /billing/layout.js.
export default function SettingsLayout({ children }) {
  return <div className="flex flex-col gap-6">{children}</div>
}
