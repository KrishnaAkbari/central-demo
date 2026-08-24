'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  MailPlus, Mail, Loader2, Shield, ShieldCheck, Eye, Sparkles,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { showToast } from '@/utils/toast-utils'
import * as api from '@/services/centralApi'
import { cn } from '@/utils'

import { RoleSelectDropdown } from './RoleSelectDropdown'

// Invite-a-member dialog. Accepts any email address:
//   - if the invitee has already registered a Central Panel account,
//     they join immediately
//   - if they haven't, the row is added as a pending invitation
//     (status: 'invited') that auto-activates when the invitee
//     eventually registers — they'll land already pre-joined to this
//     Organization.
export function AddMemberDialog({ open, onOpenChange, onSuccess }) {
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [roles, setRoles] = useState([])
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setEmail('')
      setRoleId('')
      setError(null)
      return
    }
    api.listRolesForOrg().then((list) => {
      setRoles(list)
      const member = list.find((r) => r.name === 'member')
      setRoleId(member?.id || list[0]?.id || '')
    }).catch(() => setRoles([]))
  }, [open])

  const sortedRoles = useMemo(() => {
    return roles.slice().sort((a, b) => {
      if (a.isSystem && !b.isSystem) return -1
      if (!a.isSystem && b.isSystem) return 1
      if (a.isSystem && b.isSystem) {
        return (a.name === 'admin' ? -1 : 1)
      }
      return (a.title || a.name).localeCompare(b.title || b.name)
    })
  }, [roles])

  // Build preset cards for the three common system roles. Cards only
  // render when the corresponding role exists in this Org. 'admin' and
  // 'member' are seeded as system roles; 'viewer' is shown when an Org
  // admin has created a custom Viewer role on /roles.
  const presetRoles = useMemo(() => {
    const presets = []
    const admin = roles.find((r) => r.name === 'admin')
    const member = roles.find((r) => r.name === 'member')
    const viewer = roles.find((r) => r.name === 'viewer' || /^viewer$/i.test(r.title || ''))
    if (admin)  presets.push({ id: admin.id,  icon: ShieldCheck, accent: 'indigo', title: 'Admin',  hint: 'Full access to manage everything' })
    if (member) presets.push({ id: member.id, icon: Shield,      accent: 'slate',  title: 'Member', hint: 'Day-to-day access' })
    if (viewer) presets.push({ id: viewer.id, icon: Eye,         accent: 'emerald', title: 'Viewer', hint: 'Read-only access' })
    return presets
  }, [roles])

  const selectedRole = roles.find((r) => r.id === roleId)
  const isCustomRoleSelected = !!roleId && !presetRoles.some((p) => p.id === roleId)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setError('Email is required')
      return
    }
    if (!roleId) {
      setError('Pick a role')
      return
    }
    setIsSaving(true)
    try {
      const result = await api.addOrgMember(null, cleanEmail, roleId)
      if (result?.status === 'invited') {
        showToast.success(`Invited ${cleanEmail} — will join when they register`, {
          duration: 5000,
        })
      } else {
        showToast.success(`Added ${cleanEmail}`)
      }
      onSuccess?.()
      onOpenChange?.(false)
    } catch (err) {
      setError(err?.message || 'Failed to add member')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="default"
        header={
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-start gap-4 pr-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                <MailPlus className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-slate-900 dark:text-white text-xl">
                  Add member
                </DialogTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Enter any email. If they're not registered yet, they'll be
                  invited and auto-added when they sign up.
                </p>
              </div>
            </div>
          </DialogHeader>
        }
        footer={
          <div className="px-6 py-4 flex justify-end items-center gap-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-member-form"
              disabled={isSaving || roles.length === 0}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MailPlus className="h-4 w-4" />
              )}
              Send invite
            </button>
          </div>
        }
      >
        <form id="add-member-form" onSubmit={onSubmit} className="px-6 py-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="member-email" className="text-slate-700 dark:text-slate-300 text-sm font-medium block">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-400" />
              <input
                id="member-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                autoComplete="off"
                className="w-full h-11 pl-10 pr-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 outline-none transition-colors"
              />
            </div>
            <p className="text-2xs text-slate-500 dark:text-slate-400">
              Active members join immediately. Pending invites activate the moment the invitee registers.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-slate-700 dark:text-slate-300 text-sm font-medium block">
              Role
            </label>
            {/* Quick-select cards for the three common system roles.
                Click one to set the role without opening the dropdown. */}
            {presetRoles.length > 0 && (
              <div className={cn(
                'grid gap-2',
                presetRoles.length === 1 && 'grid-cols-1',
                presetRoles.length === 2 && 'grid-cols-2',
                presetRoles.length >= 3 && 'grid-cols-3'
              )}>
                {presetRoles.map((preset) => {
                  const Icon = preset.icon
                  const isSelected = roleId === preset.id && !isCustomRoleSelected
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setRoleId(preset.id)}
                      className={cn(
                        'group flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all',
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 dark:border-indigo-400 ring-2 ring-indigo-500/30'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-700/50'
                      )}
                    >
                      <span className={cn(
                        'h-7 w-7 rounded-lg flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : preset.accent === 'indigo'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                            : preset.accent === 'emerald'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                      )}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className={cn(
                        'text-sm font-semibold leading-tight',
                        isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-900 dark:text-white'
                      )}>
                        {preset.title}
                      </span>
                      <span className="text-2xs text-slate-500 dark:text-slate-400 leading-tight">
                        {preset.hint}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {/* Fallback for custom roles. Power users can still pick any
                non-preset role from the dropdown — this lives below the
                preset cards and is clearly labelled so the common path is
                the preset cards above. */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xs text-slate-500 dark:text-slate-400 shrink-0">
                or pick a custom role
              </span>
              <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>
            <RoleSelectDropdown
              value={isCustomRoleSelected ? roleId : ''}
              roles={sortedRoles}
              onChange={(id) => setRoleId(id || '')}
              className="w-full !min-w-full h-11 px-3"
            />
            {selectedRole && (
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                <Sparkles className="h-3 w-3 inline-block mr-1 -mt-0.5 text-indigo-500 dark:text-indigo-400" />
                Selected: <span className="font-medium text-slate-700 dark:text-slate-200">{selectedRole.title || selectedRole.name}</span>
                {isCustomRoleSelected && (
                  <button
                    type="button"
                    onClick={() => {
                      // Reset to the Member preset (most common default).
                      const member = roles.find((r) => r.name === 'member')
                      setRoleId(member?.id || '')
                    }}
                    className="ml-2 text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </p>
            )}
          </div>

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
