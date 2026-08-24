"use client"

import { create } from 'zustand'
import * as api from '@/services/centralApi'

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  loading: true,
  error: null,

  // Hydrate the session from localStorage on mount.
  hydrate: async () => {
    set({ loading: true, error: null })
    try {
      const session = await api.getCurrentSession()
      if (session) {
        set({ user: session.user, token: session.token, loading: false })
      } else {
        set({ user: null, token: null, loading: false })
      }
    } catch (err) {
      set({ user: null, token: null, loading: false, error: err?.message })
    }
  },

  login: async ({ email, password }) => {
    set({ error: null })
    const { user, token } = await api.login({ email, password })
    set({ user, token, loading: false })
    return user
  },

  register: async (payload) => {
    set({ error: null })
    const { user, token } = await api.register(payload)
    set({ user, token, loading: false })
    return user
  },

  logout: async () => {
    await api.logout()
    set({ user: null, token: null })
  },

  updateProfile: async (changes) => {
    const updated = await api.updateProfile(changes)
    set({ user: updated })
    return updated
  },
}))