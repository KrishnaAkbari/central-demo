'use client'

import { useEffect, useState } from 'react'
import { Pencil, AlertTriangle } from 'lucide-react'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FieldRow } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { showToast } from '@/utils/toast-utils'

import * as api from '@/services/centralApi'

/**
 * RenameServerDialog — small dialog for renaming a connected server.
 * Mirrors RenameAccountDialog for consistency.
 *
 * Props:
 *   - open, onOpenChange — controlled visibility
 *   - server — the server record being renamed
 */
export function RenameServerDialog({ open, onOpenChange, server }) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setName(server?.name || '')
      setError(null)
    }
  }, [open, server])

  if (!server) return null

  const close = () => {
    if (submitting) return
    onOpenChange(false)
  }

  const submit = async (e) => {
    e?.preventDefault?.()
    const clean = name.trim()
    if (!clean) {
      setError('Name is required')
      return
    }
    if (clean === server.name) {
      onOpenChange(false)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.renameServer(server.id, clean)
      showToast.success('Server renamed')
      onOpenChange(false)
    } catch (err) {
      setError(err?.message || 'Failed to rename')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="default">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700">
          <DialogTitle>Rename server</DialogTitle>
          <DialogDescription>
            Update the display name. The hostname and IP on the actual server don't change.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <FieldRow label="Server name" htmlFor="rename-server-name" required>
            <Input
              id="rename-server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-server"
              maxLength={48}
              autoFocus
            />
          </FieldRow>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={close}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="default" loading={submitting} className="gap-2">
              <Pencil className="h-4 w-4" />
              Save name
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}