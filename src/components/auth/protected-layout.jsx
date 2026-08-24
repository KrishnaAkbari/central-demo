'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

import { useAuthStore } from '@/stores/authStore'
import { CentralShell } from '@/components/layout/central-shell'

// ProtectedLayout — gates any protected route under Central Panel.
// - If the session is still hydrating, show a spinner.
// - If unauthenticated, redirect to /login (with `next` query so we bounce back).
// - If authenticated, render the CentralShell with the page as content.
export function ProtectedLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Preserve the full destination (pathname + search) through the login
  // round-trip so deep links like /servers/add/create?source=connect_existing
  // land back on the right wizard step after sign-in instead of dropping the
  // source param. usePathname() alone strips ?source= and ?key= and any
  // other query string the user was trying to deep-link with.
  const search = searchParams?.toString() ?? ''
  const currentPath = pathname + (search ? `?${search}` : '')
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const hydrate = useAuthStore((s) => s.hydrate)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!user && loading && !hydrated) {
        await hydrate()
      }
      if (!cancelled) setHydrated(true)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (hydrated && !loading && !user) {
      const next = currentPath ? `?next=${encodeURIComponent(currentPath)}` : ''
      router.replace(`/login${next}`)
    }
  }, [hydrated, loading, user, router, currentPath])

  if (!hydrated || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400 dark:text-slate-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Redirecting to{' '}
          <Link href={`/login${currentPath ? `?next=${encodeURIComponent(currentPath)}` : ''}`} className="text-indigo-600 dark:text-indigo-300 hover:text-indigo-500">
            sign in
          </Link>
          …
        </div>
      </div>
    )
  }

  return <CentralShell>{children}</CentralShell>
}