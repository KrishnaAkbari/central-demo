'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { useAuthStore } from '@/stores/authStore'
import * as api from '@/services/centralApi'

export default function RootPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    api.initDemoData()
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (loading) return
    router.replace(user ? '/dashboard' : '/login')
  }, [loading, user, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400 dark:text-slate-500" />
    </div>
  )
}