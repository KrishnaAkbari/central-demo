'use client'

import { useEffect, useState } from 'react'
import { Plus, Building2 } from 'lucide-react'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldRow } from '@/components/ui/field'
import { showToast } from '@/utils/toast-utils'

import * as api from '@/services/centralApi'
import { useOrganizationStore } from '@/stores/organizationStore'

// Dialog for creating a new Organization. Used from the Organization
// switcher and from the Manage Organizations page.
export function CreateOrganizationDialog({ open, onOpenChange, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const setActive = useOrganizationStore((s) => s.setActive)
  const refresh = useOrganizationStore((s) => s.refresh)

  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setError(null)
      setBusy(false)
    }
  }, [open])

  const canSubmit = name.trim().length > 0

  const onSubmit = async (e) => {
    e?.preventDefault?.()
    if (!canSubmit || busy) return
    setError(null)
    setBusy(true)
    try {
      const created = await api.createOrganization({
        name: name.trim(),
        description: description.trim(),
      })
      await refresh()
      await setActive(created.id)
      showToast.success('Organization created')
      onCreated?.(created)
      onOpenChange?.(false)
    } catch (err) {
      setError(err?.message || 'Failed to create organization')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="default"
        header={
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-4 pr-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-slate-900 dark:text-white text-xl">
                  Create organization
                </DialogTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  An organization groups its own members, connected servers,
                  and audit log. You become its owner.
                </p>
              </div>
            </div>
          </DialogHeader>
        }
        footer={
          <div className="px-6 py-4 flex justify-end items-center gap-3 bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-org-form"
              disabled={busy || !canSubmit}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Create organization
            </button>
          </div>
        }
      >
        <form
          id="create-org-form"
          onSubmit={onSubmit}
          className="px-6 py-5 space-y-4"
        >
          <FieldRow label="Name" htmlFor="org-name">
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ServerAvatar, Client A, Personal Servers, ..."
              autoFocus
              className="h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3"
            />
          </FieldRow>
          <FieldRow label="Description" htmlFor="org-description" helper="Optional — what the organization is for.">
            <Input
              id="org-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Production servers for our clients"
              className="h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3"
            />
          </FieldRow>
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
