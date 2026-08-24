'use client'

import { useRouter } from 'next/navigation'
import { useBlueprintsStore } from '@/stores/blueprintsStore'
import { BlueprintEditor } from '@/components/blueprints/BlueprintEditor'
import { showToast } from '@/utils/toast-utils'

export default function NewBlueprintPage() {
  const router = useRouter()
  const create = useBlueprintsStore((s) => s.create)

  const handleSave = async (payload) => {
    try {
      const created = await create(payload)
      showToast.success('Blueprint created', `${created.name} is ready to use.`)
      router.push('/blueprints')
    } catch (err) {
      throw err
    }
  }

  return (
    <BlueprintEditor
      initial={null}
      onSave={handleSave}
      breadcrumbs={[
        { label: 'Blueprints', href: '/blueprints' },
        { label: 'New blueprint' },
      ]}
    />
  )
}