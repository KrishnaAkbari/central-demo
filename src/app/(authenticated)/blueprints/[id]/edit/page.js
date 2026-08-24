'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { LoadingState } from '@/components/ui/page'
import { useBlueprintsStore } from '@/stores/blueprintsStore'
import { BlueprintEditor } from '@/components/blueprints/BlueprintEditor'
import { showToast } from '@/utils/toast-utils'

export default function EditBlueprintPage() {
  const router = useRouter()
  // useParams() is the reliable way to read dynamic segments in client
  // components. The `params` prop on the page function can be undefined or
  // stale on the first render under Next.js 14 App Router, which causes the
  // "Blueprint not found" flash before hydration completes.
  const params = useParams()
  const id = params?.id
  const { blueprints, loaded, load, update } = useBlueprintsStore()

  // Hydrate the store if we landed here directly (deep link) without going
  // through the list page first. The store's `loaded` flag is the source of
  // truth — no need for a separate local `hydrated` state.
  useEffect(() => {
    if (!loaded) load()
  }, [loaded, load])

  const handleSave = async (payload) => {
    try {
      await update(id, payload)
      showToast.success('Blueprint updated', `${payload.name} saved.`)
      router.push('/blueprints')
    } catch (err) {
      throw err
    }
  }

  // First render: store hasn't loaded yet → show loading state. This avoids
  // flashing "Blueprint not found" before the data arrives.
  if (!loaded) {
    return <LoadingState message="Loading blueprint…" />
  }

  const blueprint = blueprints.find((b) => b.id === id)

  if (!blueprint) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Blueprint not found.
        </p>
        <button
          type="button"
          onClick={() => router.push('/blueprints')}
          className="mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Back to Blueprints
        </button>
      </div>
    )
  }

  return (
    <BlueprintEditor
      initial={blueprint}
      onSave={handleSave}
      breadcrumbs={[
        { label: 'Blueprints', href: '/blueprints' },
        { label: blueprint.name },
      ]}
    />
  )
}