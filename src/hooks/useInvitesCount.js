'use client'

import { useEffect, useState } from 'react'

import { useAuthStore } from '@/stores/authStore'
import { useActiveOrganization } from '@/stores/organizationStore'
import { useCan } from './useCan'

/**
 * Pending invites badge hook — how many outstanding invitations exist
 * for the active Organization. The Members page shows these rows in a
 * separate "Invitations" section; this hook lets the sidebar show a
 * matching count without re-fetching through the API.
 *
 * Source: cp_memberships in localStorage filtered by
 *   organizationId === activeOrgId && status === 'invited'
 *
 * Returns null for users without member.manage permission — viewers
 * shouldn't see invites they can't act on. Returns 0 when there are
 * none, so callers can check `count > 0` to show the badge.
 *
 * Stays in sync with cross-tab storage events so opening the page in
 * two tabs stays consistent.
 */
export function useInvitesCount() {
  const me = useAuthStore((s) => s.user)
  const activeOrg = useActiveOrganization()
  const canManage = useCan('organization.members.manage')
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!canManage || !activeOrg?.id || typeof window === 'undefined') {
      setCount(0)
      return
    }
    const recompute = () => {
      try {
        const rows = JSON.parse(localStorage.getItem('cp_memberships') || '[]')
        const invites = rows.filter(
          (m) => m.organizationId === activeOrg.id && (m.status || 'active') === 'invited'
        )
        setCount(invites.length)
      } catch {
        setCount(0)
      }
    }
    recompute()
    window.addEventListener('storage', recompute)
    window.addEventListener('cp:memberships-changed', recompute)
    return () => {
      window.removeEventListener('storage', recompute)
      window.removeEventListener('cp:memberships-changed', recompute)
    }
  }, [activeOrg?.id, canManage, me?.id])

  if (!canManage) return null
  return count
}
