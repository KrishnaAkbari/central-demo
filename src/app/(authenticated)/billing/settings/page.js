'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// /billing/settings — redirect to Profile sub-tab. After Round 30 IA
// redesign, Settings only contains Profile (billing details: name,
// address, tax ID). The redirect stays so /billing/settings lands
// directly on the only sub-page.
export default function SettingsIndex() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/billing/settings/profile')
  }, [router])
  return null
}