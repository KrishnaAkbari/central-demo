'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save, Lock, UserCircle2, AlertTriangle, Trash2 } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { FieldRow } from '@/components/ui/field'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'

import { useAuthStore } from '@/stores/authStore'
import { showToast } from '@/utils/toast-utils'
import { getActorColor, getActorInitials } from '@/utils/avatar-utils'

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const updateProfile = useAuthStore((s) => s.updateProfile)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)

  // Lightweight strength scorer: length + variety. Returns 0–4.
  // 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong.
  const passwordScore = (pw) => {
    if (!pw) return 0
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
    return Math.min(score, 4)
  }
  const pwMismatch = confirmPw.length > 0 && newPw !== confirmPw
  const newPwValid = newPw.length >= 8 && (!confirmPw || newPw === confirmPw) && currentPw.length > 0

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setEmail(user.email || '')
    }
  }, [user])

  const onSaveProfile = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await updateProfile({ name, email })
      showToast.success('Profile updated')
    } catch (err) {
      showToast.error(err?.message || 'Failed to update profile')
    } finally {
      setBusy(false)
    }
  }

  const onChangePassword = async (e) => {
    e.preventDefault()
    if (newPw !== confirmPw) {
      showToast.error('New passwords do not match')
      return
    }
    setPwBusy(true)
    try {
      await updateProfile({ currentPassword: currentPw, newPassword: newPw })
      showToast.success('Password changed')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err) {
      showToast.error(err?.message || 'Failed to change password')
    } finally {
      setPwBusy(false)
    }
  }

  const profileDirty = user && (name !== user.name || email !== user.email)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  return (
    <PageContainer size="sm">
      <div className="flex items-center gap-4">
        <div className={cn(
          'h-16 w-16 sm:h-20 sm:w-20 rounded-2xl flex items-center justify-center text-xl sm:text-2xl font-bold shrink-0',
          user ? getActorColor(user.email) : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        )}>
          {user ? getActorInitials(user.name, user.email) : '?'}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Profile
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
            {user?.name || 'Your account'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
            {user?.email}
          </p>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <UserCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Account information</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Update your name and email.</p>
          </div>
        </div>

        <form onSubmit={onSaveProfile} className="p-6 space-y-4">
          <FieldRow label="Full name" htmlFor="name">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
              className="h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3" />
          </FieldRow>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium leading-snug">Email</span>
              <Badge variant="success" title="Demo mode: emails are auto-verified" className="text-xxs uppercase tracking-wider px-1.5 py-0.5 gap-1">
                <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Verified
              </Badge>
            </div>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
              className="h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3" />
          </div>
          <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button type="submit" loading={busy} disabled={!profileDirty} size="default" className="gap-2">
              <Save className="h-4 w-4" />
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Change password</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pick a new password for your Central Panel account.</p>
          </div>
        </div>

        <form onSubmit={onChangePassword} className="p-6 space-y-4">
          <FieldRow label="Current password" htmlFor="current-pw">
            <Input id="current-pw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password"
              className="h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3" />
          </FieldRow>
          <FieldRow label="New password" htmlFor="new-pw" helper="At least 8 characters.">
            <div className="space-y-2">
              <Input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password"
                className="h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3" />
              {newPw.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex gap-0.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex-1 transition-colors',
                          passwordScore(newPw) >= i
                            ? passwordScore(newPw) <= 1 ? 'bg-red-500'
                            : passwordScore(newPw) === 2 ? 'bg-amber-500'
                            : passwordScore(newPw) === 3 ? 'bg-yellow-500'
                            : 'bg-emerald-500'
                            : 'bg-transparent'
                        )}
                      />
                    ))}
                  </div>
                  <span className={cn(
                    'text-xs font-medium tabular-nums shrink-0',
                    passwordScore(newPw) <= 1 ? 'text-red-600 dark:text-red-400'
                    : passwordScore(newPw) === 2 ? 'text-amber-600 dark:text-amber-400'
                    : passwordScore(newPw) === 3 ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                  )}>
                    {['', 'Weak', 'Fair', 'Good', 'Strong'][passwordScore(newPw)]}
                  </span>
                </div>
              )}
            </div>
          </FieldRow>
          <FieldRow label="Confirm new password" htmlFor="confirm-pw"
            helper={!pwMismatch ? 'Re-enter the new password to confirm.' : undefined}
            error={pwMismatch ? 'Passwords do not match' : undefined}>
            <Input id="confirm-pw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password"
              className={cn(
                'h-11 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3',
                pwMismatch
                  ? 'border-red-400 dark:border-red-500/60 focus-visible:ring-red-400'
                  : 'border-slate-200 dark:border-slate-700'
              )} />
          </FieldRow>
          <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button type="submit" loading={pwBusy} disabled={!newPwValid} size="default" className="gap-2">
              <Save className="h-4 w-4" />
              Change password
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden border-rose-200 dark:border-rose-500/30">
        <div className="px-6 py-4 bg-rose-50/50 dark:bg-rose-500/5 border-b border-rose-200 dark:border-rose-500/20 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-rose-900 dark:text-rose-100">Danger zone</h2>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">Irreversible and destructive actions.</p>
          </div>
        </div>
        <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white">Delete your account</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
              Permanently removes your user account. You will lose access to every organization where you are the sole owner.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 shrink-0"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete your account?"
        loading={deleteBusy}
        confirmLabel="Yes, delete my account"
        confirmVariant="destructive"
        onConfirm={async () => {
          setDeleteBusy(true)
          try {
            await new Promise((r) => setTimeout(r, 600))
            showToast.info('Account deletion is a demo placeholder — your data is still here.')
            setConfirmDelete(false)
          } finally {
            setDeleteBusy(false)
          }
        }}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This will permanently remove your user account from Central Panel. Any organization where you are the only owner must be transferred or deleted first.
        </p>
      </ConfirmDialog>
    </PageContainer>
  )
}