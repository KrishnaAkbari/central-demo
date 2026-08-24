'use client'

import { useState, useEffect } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ShieldAlert, AlertTriangle, Loader2, Trash2, Copy, Check } from 'lucide-react'
import * as api from '@/services/centralApi'
import { showToast } from '@/utils/toast-utils'

// Delete-role confirmation modal. Mirrors OSP's DeleteRoleModal:
//  - ConfirmDialog shell (Central Panel's existing primitive)
//  - Role-to-delete label section with a small role card
//  - Warning box describing what deletion does
//  - Type-to-confirm input matching the role slug
//  - Cancel + Delete role footer buttons (wired by ConfirmDialog)
export function DeleteRoleModal({ open, onOpenChange, role, onSuccess }) {
  const [confirmInput, setConfirmInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setConfirmInput('')
      setCopied(false)
    }
  }, [open, role?.id])

  if (!role) return null

  const expectedName = role.name || ''
  const isMatch = confirmInput.trim() === expectedName
  const canDelete = isMatch && !isSaving
  const permissionsCount = (role.permissions || []).length

  const handleCopySlug = async () => {
    if (!expectedName) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(expectedName)
      } else {
        const ta = document.createElement('textarea')
        ta.value = expectedName
        Object.assign(ta.style, { position: 'fixed', top: '0', left: '0', opacity: '0', pointerEvents: 'none' })
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        ta.setSelectionRange(0, expectedName.length)
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      showToast.error('Failed to copy role name')
    }
  }

  const handleDelete = async () => {
    if (!canDelete) return
    setIsSaving(true)
    try {
      await api.deleteRole(role.id)
      showToast.success(`Role "${role.title}" deleted`)
      onSuccess?.()
      onOpenChange?.(false)
    } catch (err) {
      showToast.error(err?.message || 'Failed to delete role')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => onOpenChange?.(false)

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Role"
      icon={<Trash2 className="h-4 w-4" />}
      confirmText={isSaving ? 'Deleting…' : 'Delete Role'}
      cancelText="Cancel"
      variant="destructive"
      loading={isSaving}
      confirmDisabled={!canDelete}
      onConfirm={handleDelete}
      onCancel={handleCancel}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Role to delete
          </p>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 text-slate-700 dark:text-slate-200 shrink-0">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{role.title}</p>
                <button
                  type="button"
                  onClick={handleCopySlug}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors shrink-0"
                  title="Copy role name"
                  aria-label="Copy role name"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                  {role.name}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  · {permissionsCount} {permissionsCount === 1 ? 'permission' : 'permissions'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-3 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-xs font-semibold text-red-700 dark:text-red-300">
              What happens when you delete this role
            </p>
          </div>
          <ul className="text-2xs text-red-700 dark:text-red-300 space-y-0.5 pl-5 list-disc">
            <li>All permissions granted by this role are removed from assigned members</li>
            <li>Members keep their assignment but lose access through it</li>
            <li>The role cannot be recovered — you would have to recreate it</li>
            <li>Members currently using this role will need a different role assigned</li>
          </ul>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-role-name" className="text-slate-700 dark:text-slate-300 text-sm font-medium block">
            Type <span className="font-mono font-semibold text-slate-900 dark:text-white">{expectedName}</span> to confirm
          </label>
          <input
            id="confirm-role-name"
            autoComplete="off"
            autoFocus
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={expectedName}
            className="h-10 w-full px-3 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canDelete) handleDelete()
            }}
          />
        </div>

        {isSaving && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Deleting role…
          </div>
        )}
      </div>
    </ConfirmDialog>
  )
}