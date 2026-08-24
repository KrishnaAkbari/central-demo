'use client'

import { useEffect, useState } from 'react'
import { Pencil, AlertTriangle } from 'lucide-react'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FieldRow } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { showToast } from '@/utils/toast-utils'

import * as api from '@/services/centralApi'

/**
 * RenameAccountDialog — small dialog for renaming a single connected
 * provider account. Used from the integrations page's account-row kebab
 * and (legacy) from inside the provider modal. Standalone so the page
 * can call it directly without depending on the bigger provider modal.
 *
 * Props:
 *   - open, onOpenChange — controlled visibility
 *   - account — the connected record being renamed
 *   - onSuccess — optional callback fired after a successful rename so
 *     the parent can refresh its connected list
 */
export function RenameAccountDialog({ open, onOpenChange, account, onSuccess }) {
  const [label, setLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const catalog = account ? api.PROVIDER_CATALOG.find((p) => p.id === account.provider) : null

  // Reset the input whenever the dialog opens or the target changes.
  useEffect(() => {
    if (open) {
      setLabel(account?.label || '')
      setError(null)
    }
  }, [open, account])

  if (!account || !catalog) return null

  const close = () => {
    if (submitting) return
    onOpenChange(false)
  }

  const submit = async () => {
    const clean = label.trim()
    if (!clean) {
      setError('Label is required')
      return
    }
    if (clean === account.label) {
      onOpenChange(false)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await api.renameProviderAccount(account.id, clean)
      showToast.success('Account renamed')
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      setError(err?.message || 'Failed to rename account')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = label.trim().length > 0 && label.trim() !== account.label && !submitting

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        size="default"
        header={
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="text-slate-900 dark:text-white text-xl">
              Rename account
            </DialogTitle>
            <DialogDescription className="mt-1">
              Pick a friendly name you can tell apart from any other account of the same provider.
            </DialogDescription>
          </DialogHeader>
        }
      >
        <div className="px-6 py-5 space-y-5">
          <Card className="p-4 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-2.5">
              <span
                className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: catalog.color }}
                aria-hidden
              >
                {catalog.name[0]}
              </span>
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">{catalog.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Renaming an account changes how it appears in Central Panel only.
                </div>
              </div>
            </div>
          </Card>

          <FieldRow
            label="Account label"
            htmlFor="rename-account-label"
            required
          >
            <Input
              id="rename-account-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={48}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
          </FieldRow>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="outline"  onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              
              onClick={submit}
              disabled={!canSubmit}
              loading={submitting}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              Save name
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}