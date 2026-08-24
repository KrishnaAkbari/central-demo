'use client'

import { useCount } from './useCount'
import { useAuthStore } from '@/stores/authStore'

/**
 * Counts used in the sidebar nav for scannability.
 *
 * - membersTotal: every row in cp_memberships for the active Organization,
 *   regardless of status (active members + invited + any pending).
 *   Shows as a quiet slate secondary count next to "Members".
 *
 * - orgsTotal: distinct Organizations the *current user* has a membership
 *   row for, across all statuses (active, invited). Shows as a slate
 *   secondary count next to "Organizations" in the sidebar.
 *
 * Both counts stay reactive with the same localStorage event hooks the
 * rest of the chrome uses. Returns null while the active Org or user is
 * still hydrating so we don't briefly render 0 on cold load.
 */
export function useSidebarCounts() {
  const me = useAuthStore((s) => s.user)
  const myId = me?.id

  const membersTotal = useCount({
    storageKey: 'cp_memberships',
    orgId: true,
    predicate: () => true,
  })

  // Count distinct orgs where the current user has ANY membership row.
  // Deduped by organizationId so a user with multiple roles in one Org
  // (shouldn't happen in practice, but defensively) still counts once.
  const orgsTotal = useCount({
    storageKey: 'cp_memberships',
    orgId: false,
    predicate: (row) => !!myId && row.userId === myId,
    eventNames: ['cp:memberships-changed', 'cp:organizations-changed'],
    distinctBy: 'organizationId',
    dependencies: [myId],
  })

  return { membersTotal, orgsTotal }
}
