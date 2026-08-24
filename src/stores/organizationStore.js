'use client'

import { create } from 'zustand'
import * as api from '@/services/centralApi'
import { useAuthStore } from './authStore'

// Active-Organization store. Mirrors the useAuthStore shape so pages can
// stay consistent in how they consume zustand state.
//
// Responsibility:
//  - Hold the list of Organizations the current user belongs to.
//  - Hold the active Organization id (persisted in cp_active_org).
//  - Expose setActive() that persists the choice and lets pages refetch
//    scoped data via the orgId they read from `useOrganizationStore`.
//  - Expose `isOwner` selector — true when the current user has no
//    roleId assigned in cp_memberships for the active org. The owner
//    has implicit access to every action including the owner-only
//    server-sharing flows.
//
// Per Task 1 scope:
//  - The "create / rename / delete" actions are wired in Step 5.
//  - Member-management UI (add / change role / remove) is Task 2.

export const useOrganizationStore = create((set, get) => ({
  organizations: [],
  activeOrgId: null,
  loading: true,
  error: null,
  // Bumped whenever a billing-state mutation might change the user's
  // owner status (e.g. seedPersona flipping roleId for non_owner_member).
  // useIsOwner reads this as a dependency so the boolean re-evaluates
  // without needing a full page reload or Zustand-side mutations.
  ownerVersion: 0,
  // Bumped on every billing-state mutation. Billing pages that derive
  // `vm` from localStorage (getActiveOrgBilling / getWallet / etc.)
  // should add `useBillingVersion()` to their useEffect deps so the
  // view-model re-pulls from localStorage after seedPersona, plan
  // changes, payment-method updates, wallet top-ups, etc. Without this,
  // pages show stale `planTier` / wallet balance / transactions after
  // any persona switch (e.g. switch from non_owner_member back to a
  // owner persona shows the OLD persona's plan because the page's
  // vm useEffect doesn't re-fire on storage events).
  billingVersion: 0,

  hydrate: async () => {
    set({ loading: true, error: null })
    try {
      const orgs = await api.listOrganizationsForUser()
      const stored = await api.getActiveOrganizationId()
      // Pick stored active if it still belongs to the user, otherwise
      // the first Organization. If the user has zero Orgs (legacy edge
      // case — should not happen post-registration), activeOrgId stays
      // null and the layout redirects to /organizations.
      let activeId = null
      if (stored && orgs.some((o) => o.id === stored)) {
        activeId = stored
      } else if (orgs.length > 0) {
        activeId = orgs[0].id
        await api.setActiveOrganizationId(activeId)
      }
      set({ organizations: orgs, activeOrgId: activeId, loading: false })
    } catch (err) {
      set({ loading: false, error: err?.message })
    }
  },

  setActive: async (orgId) => {
    await api.setActiveOrganizationId(orgId)
    set({ activeOrgId: orgId })
  },

  refresh: async () => {
    const orgs = await api.listOrganizationsForUser()
    set({ organizations: orgs })
    // If the active org disappeared, fall back to the first.
    const { activeOrgId } = get()
    if (!orgs.some((o) => o.id === activeOrgId)) {
      const next = orgs[0]?.id || null
      if (next) await api.setActiveOrganizationId(next)
      set({ activeOrgId: next })
    }
  },
}))

// Convenience selector for the active Organization object. Components
// that need the full org (for display name etc.) use this.
export function useActiveOrganization() {
  const orgs = useOrganizationStore((s) => s.organizations)
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  return orgs.find((o) => o.id === activeOrgId) || null
}

// One-shot module-level listener: bump ownerVersion AND billingVersion
// whenever billing state changes. seedPersona emits 'billing:state-changed'
// on every mutation, so this gives us a single integration point to keep
// owner-only gates AND billing-data views in sync without wiring per-page
// event handlers.
//
// Idempotent guard: with Next.js HMR, modules can re-evaluate and stack
// multiple listeners. A module-level symbol ensures we only bind once.
if (typeof window !== 'undefined' && !window.__orgStoreOwnerListener) {
  window.__orgStoreOwnerListener = true
  window.addEventListener('billing:state-changed', () => {
    useOrganizationStore.setState((s) => ({
      ownerVersion: s.ownerVersion + 1,
      billingVersion: s.billingVersion + 1,
    }))
  })
}

// Selector hook returning a counter that increments every time billing
// state mutates. Pages that derive view-models from localStorage (e.g.
// `getActiveOrgBilling()`, `getWallet(id)`, `getTransactions(id)`) MUST
// add `useBillingVersion()` to their useEffect deps so they re-pull from
// localStorage after seedPersona, plan switches, payment-method updates,
// etc. Without it, the cached `vm` shows stale data (wrong plan tier,
// stale wallet balance, old transactions list).
//
// Typical use:
//   const billingVersion = useBillingVersion()
//   useEffect(() => { setVm(build()) }, [activeOrgId, billingVersion])
export function useBillingVersion() {
  return useOrganizationStore((s) => s.billingVersion)
}

// Returns true when the current user owns the active Organization
// (their cp_memberships row for this org has roleId === null).
// Drives the Owner-only server-sharing UI (Select toggle on /servers,
// Share-with-someone button on /servers/[id]). Safe to call from any
// client component. Returns false if there's no active user, no active
// org, or the membership row is missing.
export function useIsOwner() {
  const user = useAuthStore((s) => s.user)
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  // Subscribe to the billing-state-changed event so that localStorage
  // mutations performed by seedPersona (e.g. roleId flips when picking
  // non_owner_member) force a re-evaluation. Without this, useIsOwner
  // returns stale data and owner-only pages don't gate themselves after
  // the user switches to a non-owner persona.
  const ownerVersion = useOrganizationStore((s) => s.ownerVersion)
  if (!user || !activeOrgId) return false
  // Read `ownerVersion` so React tracks the dependency; the value itself
  // doesn't affect the boolean — it just guarantees the hook re-runs.
  void ownerVersion
  return api.isOrganizationOwner(user.id, activeOrgId)
}