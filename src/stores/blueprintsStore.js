'use client'

import { create } from 'zustand'
import * as api from '@/services/blueprintsApi'

export const useBlueprintsStore = create((set, get) => ({
  blueprints: [],
  loading: false,
  error: null,
  loaded: false,

  load: async () => {
    if (get().loaded) return
    set({ loading: true, error: null })
    try {
      const blueprints = await api.listBlueprints()
      set({ blueprints, loading: false, loaded: true })
    } catch (err) {
      set({ error: err?.message || 'Failed to load blueprints', loading: false })
    }
  },

  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const blueprints = await api.listBlueprints()
      set({ blueprints, loading: false, loaded: true })
    } catch (err) {
      set({ error: err?.message || 'Failed to refresh blueprints', loading: false })
    }
  },

  create: async (input) => {
    const blueprint = await api.createBlueprint(input)
    set((s) => ({ blueprints: [blueprint, ...s.blueprints] }))
    return blueprint
  },

  update: async (id, patch) => {
    const updated = await api.updateBlueprint(id, patch)
    set((s) => ({
      blueprints: s.blueprints.map((b) => (b.id === id ? updated : b)),
    }))
    return updated
  },

  remove: async (id) => {
    await api.deleteBlueprint(id)
    set((s) => ({ blueprints: s.blueprints.filter((b) => b.id !== id) }))
  },

  duplicate: async (id) => {
    const copy = await api.duplicateBlueprint(id)
    set((s) => ({ blueprints: [copy, ...s.blueprints] }))
    return copy
  },

  // Cross-tab sync — pick up changes from other tabs/windows
  _onStorage: () => get().refresh(),
}))

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'central:wp-blueprints:v1') {
      useBlueprintsStore.getState().refresh()
    }
  })
  window.addEventListener('blueprints:changed', () => {
    useBlueprintsStore.getState().refresh()
  })
}
