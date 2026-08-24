'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

import { ProtectedLayout } from '@/components/auth/protected-layout'
import { useOrganizationStore } from '@/stores/organizationStore'
import { LoadingState } from '@/components/ui/page'

// AuthenticatedLayout hydrates the active Organization store on mount,
// after auth hydration. Every newly-registered account is guaranteed a
// default "Personal" Organization created by the auth flow, so pages
// never need to redirect to /organizations just to set up. The redirect
// below is a defensive safety net for legacy / corrupted localStorage
// only and does not fire in normal use.
export default function AuthenticatedLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const hydrate = useOrganizationStore((s) => s.hydrate)
  const loading = useOrganizationStore((s) => s.loading)
  const orgs = useOrganizationStore((s) => s.organizations)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    // Wait for hydration to finish before deciding to redirect.
    if (loading) return
    if (orgs.length === 0 && pathname !== '/organizations') {
      router.replace('/organizations')
    }
  }, [loading, orgs.length, pathname, router])

  if (loading && orgs.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <LoadingState label="Loading your workspace…" />
      </div>
    )
  }

  return <ProtectedLayout>{children}</ProtectedLayout>
}