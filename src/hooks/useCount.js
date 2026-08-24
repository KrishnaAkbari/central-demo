'use client'

import { useEffect, useState } from 'react'

import { useAuthStore } from '@/stores/authStore'
import { useActiveOrganization, useOrganizationStore } from '@/stores/organizationStore'

/**
 * Reactive count of rows in a localStorage-backed mock list, scoped to
 * the active Organization when an `orgId` option is true.
 *
 * Reads from `cp_memberships` (or any other key passed via `storageKey`)
 * and applies an optional `predicate` filter. Recomputes on the custom
 * `cp:memberships-changed` event (and other named events) so same-tab
 * writes cause an immediate refresh. Also listens for cross-tab `storage`
 * events so two open tabs stay consistent.
 *
 * Returns `null` while the inputs it depends on are still hydrating, so
 * callers can decide whether to render a placeholder or nothing.
 */
export function useCount({ storageKey = 'cp_memberships', predicate = () => true, orgId = true, eventNames = ['cp:memberships-changed'], distinctBy = null, dependencies = [] } = {}) {
  const me = useAuthStore((s) => s.user)
  const activeOrg = useActiveOrganization()
  const hydrating = useOrganizationStore((s) => s.status === 'idle')
  const [count, setCount] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (orgId && !activeOrg?.id) {
      setCount(null)
      return
    }
    const targetOrgId = orgId ? activeOrg.id : null
    const recompute = () => {
      try {
        const rows = JSON.parse(localStorage.getItem(storageKey) || '[]')
        const matched = rows.filter((r) => (!targetOrgId || r.organizationId === targetOrgId) && predicate(r))
        if (distinctBy) {
          const seen = new Set()
          let n = 0
          for (const r of matched) {
            const key = r[distinctBy]
            if (!seen.has(key)) { seen.add(key); n += 1 }
          }
          setCount(n)
        } else {
          setCount(matched.length)
        }
      } catch {
        setCount(0)
      }
    }
    recompute()
    const onStorage = (e) => { if (e.key === storageKey) recompute() }
    window.addEventListener('storage', onStorage)
    for (const name of eventNames) window.addEventListener(name, recompute)
    return () => {
      window.removeEventListener('storage', onStorage)
      for (const name of eventNames) window.removeEventListener(name, recompute)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, orgId, activeOrg?.id, me?.id, distinctBy, ...dependencies, ...(hydrating ? [false] : [true])])

  return count
}
