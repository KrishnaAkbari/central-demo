'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserPlus, ShieldAlert, ShieldCheck, ServerCog, ScrollText, Check, X } from 'lucide-react'

import { useAuthStore } from '@/stores/authStore'
import { showToast } from '@/utils/toast-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { AuthShell, AuthBrand, AuthHero } from '@/components/layout/auth-shell'

const REGISTER_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Role-based access control',
    description: 'Invite members with custom roles and per-server permissions.',
  },
  {
    icon: ServerCog,
    title: 'One panel for every server',
    description: 'Connect, monitor, and operate all your servers from a single control room.',
  },
  {
    icon: ScrollText,
    title: 'Tamper-evident audit log',
    description: 'Every action is recorded with who did what, when, and from where.',
  },
]

export default function RegisterPage() {
  const router = useRouter()
  const register = useAuthStore((s) => s.register)
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  const [form, setForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    passwordConfirm: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [loading, user, router])

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) errs.email = 'Enter a valid email'
    if (!form.username.trim()) errs.username = 'Username is required'
    else if (!/^[a-zA-Z0-9_-]{2,32}$/.test(form.username.trim())) errs.username = '2–32 characters, letters, numbers, underscore or hyphen'
    if (!form.password) errs.password = 'Password is required'
    else if (form.password.length < 8) errs.password = 'At least 8 characters'
    if (form.password !== form.passwordConfirm) errs.passwordConfirm = 'Passwords do not match'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        username: form.username.trim(),
        password: form.password,
      })
      showToast.success('Account created')
      router.replace('/dashboard')
    } catch (err) {
      const msg = err?.message || 'Failed to register'
      if (/email/i.test(msg)) setErrors({ email: msg })
      else if (/username/i.test(msg)) setErrors({ username: msg })
      else if (/password/i.test(msg)) setErrors({ password: msg })
      else setErrors({ name: msg })
    } finally {
      setSubmitting(false)
    }
  }

  const passwordMismatch =
    form.passwordConfirm.length > 0 && form.password !== form.passwordConfirm
  const passwordMatch =
    form.passwordConfirm.length > 0 &&
    form.password === form.passwordConfirm &&
    form.password.length > 0

  return (
    <AuthShell
      hero={
        <AuthHero
          eyebrow="Get started"
          headline="Set up your Central Panel control room"
          subtitle="One account to manage every connected server, every team member, and every audit entry."
          features={REGISTER_FEATURES}
        />
      }
    >
      <Card className="border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/40">
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="lg:hidden">
            <AuthBrand />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Create your account
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              The first account becomes the team owner. Invite members after.
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300/80 leading-relaxed">
              Demo mode. Your account is stored in this browser only.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FieldShell label="Full name" htmlFor="name" error={errors.name}>
              <Input
                ref={nameRef}
                id="name"
                autoComplete="name"
                value={form.name}
                onChange={onChange('name')}
                placeholder="Your name"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
                className="h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </FieldShell>

            <FieldShell label="Email" htmlFor="email" error={errors.email}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={onChange('email')}
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className="h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </FieldShell>

            <FieldShell
              label="Username"
              htmlFor="username"
              error={errors.username}
              hint="2–32 characters, letters, numbers, underscore or hyphen"
            >
              <Input
                id="username"
                autoComplete="username"
                value={form.username}
                onChange={onChange('username')}
                placeholder="krishna"
                aria-invalid={!!errors.username}
                aria-describedby={errors.username ? 'username-error' : 'username-hint'}
                className="h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </FieldShell>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldShell label="Password" htmlFor="password" error={errors.password}>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={onChange('password')}
                  placeholder="At least 8 characters"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className="h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </FieldShell>

              <FieldShell
                label="Confirm password"
                htmlFor="passwordConfirm"
                error={errors.passwordConfirm}
              >
                <Input
                  id="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  value={form.passwordConfirm}
                  onChange={onChange('passwordConfirm')}
                  placeholder="Repeat password"
                  aria-invalid={!!errors.passwordConfirm || passwordMismatch}
                  aria-describedby={
                    errors.passwordConfirm ? 'passwordConfirm-error' : undefined
                  }
                  className="h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </FieldShell>
            </div>

            {passwordMatch && (
              <p className="text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Passwords match
              </p>
            )}
            {passwordMismatch && !errors.passwordConfirm && (
              <p className="text-xs flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <X className="h-3.5 w-3.5" />
                Passwords don't match yet
              </p>
            )}

            <Button type="submit" loading={submitting} className="w-full mt-2" size="lg">
              <UserPlus className="h-4 w-4" />
              Create account
            </Button>
          </form>

          <p className="text-2xs text-slate-400 dark:text-slate-500 text-center leading-relaxed">
            By creating an account you agree to our{' '}
            <span className="underline underline-offset-2 decoration-slate-300 dark:decoration-slate-700">
              Terms
            </span>{' '}
            and{' '}
            <span className="underline underline-offset-2 decoration-slate-300 dark:decoration-slate-700">
              Privacy Policy
            </span>
            .
          </p>
        </CardContent>
        <div className="px-6 sm:px-8 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            Sign in
          </Link>
        </div>
      </Card>
    </AuthShell>
  )
}

function FieldShell({ label, htmlFor, error, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-slate-700 dark:text-slate-300 block"
      >
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-2xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}