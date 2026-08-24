'use client'

import { redirect } from 'next/navigation'

// /teams merged into /organizations when the central tenant model moved
// from Teams to Organizations. Anyone landing on this URL gets redirected.
export default function TeamsPage() {
  redirect('/organizations')
}