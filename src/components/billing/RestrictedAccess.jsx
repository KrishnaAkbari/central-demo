'use client'

import { Lock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PersonaSwitcher } from './PersonaSwitcher'

// RestrictedAccess — owner-only billing screen for non-owner members.
//
// Recovery contract:
//   1. Always render the PersonaSwitcher so the user can manually
//      escape (even if some other gate fires later).
//
// Previous safety-net auto-reset (auto-reseed to default if persona was
// non_owner_member on mount) was removed 2026-07-16 because it was
// FIRED on legitimate clicks too — user picks non_owner_member, page
// re-renders, RestrictedAccess mounts, useEffect sees the persona and
// immediately resets it back. The user's click effectively no-ops.
// The symmetry fix in seedPersona is the real fix: switching AWAY from
// non_owner_member restores owner status. So a stuck user can always
// pick a different persona to escape. No auto-reset needed.
//
// Layout note: the helper paragraph now sits ABOVE the PersonaSwitcher
// (instead of below) so the dropdown can open downward in clear card
// space. Without this the dropdown was clipping the helper text and
// running out of room before all 17 persona options scrolled into view.
export function RestrictedAccess() {
  return (
    <div className="p-6">
      <Card className="max-w-2xl mx-auto p-10 text-center border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">
          <Lock className="h-6 w-6 text-slate-500 dark:text-slate-400" />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Restricted access
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
          You do not have permission to manage billing for this organization.
          Please contact the organization owner.
        </p>
        <p className="mt-3 text-2xs text-slate-500 dark:text-slate-400">
          Demo: pick any persona except <em>Non-owner member</em> to regain
          access.
        </p>
        {/* PersonaSwitcher uses Radix DropdownMenu which portals to body —
            dropdown is never clipped by the Card's overflow-hidden and
            Radix's collision detection opens up when there's no room
            below the trigger. */}
        <div className="mt-6 flex justify-center">
          <PersonaSwitcher />
        </div>
      </Card>
    </div>
  )
}
