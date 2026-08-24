'use client'

import { useAuthStore } from '@/stores/authStore'
import { useOrganizationStore } from '@/stores/organizationStore'
import { can as canCheck, resolveMemberRole } from '@/services/centralApi'

// React hook for permission checks. Returns true when the current user
// has the requested permission inside the active Organization.
//
// Resolution rules:
//   1. If the user has no auth session → false.
//   2. If the active Org is missing → false.
//   3. If the user is the Org owner (roleId === null) → true for any
//      permission. The owner is implicitly all-powerful.
//   4. Otherwise look up the role row by roleId and check its
//      `permissions` array. If the role was deleted after the member
//      was assigned, the lookup returns undefined → false.
//
// Usage:
//   const can = useCan('organization.servers.manage')
//   <Button disabled={!can} ...>
//
// For service-layer enforcement (mutations called from a non-React
// context), use the synchronous `assertCan(userId, orgId, permission)`
// helper exported from centralApi instead.
export function useCan(permissionId) {
  const user = useAuthStore((s) => s.user)
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  if (!user || !activeOrgId || !permissionId) return false
  return canCheck(user.id, activeOrgId, permissionId)
}

// Returns the role object assigned to the current user in the active
// Organization, or null for owner / no membership / deleted role.
// Useful for UIs that need to render the role title in Member pickers.
export function useCurrentMemberRole() {
  const user = useAuthStore((s) => s.user)
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  if (!user || !activeOrgId) return null
  return resolveMemberRole(user.id, activeOrgId)
}