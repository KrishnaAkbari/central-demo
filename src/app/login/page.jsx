'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, LogIn, ShieldAlert, ShieldCheck, ServerCog, ScrollText } from 'lucide-react'

import { useAuthStore } from '@/stores/authStore'
import { showToast } from '@/utils/toast-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { AuthShell, AuthBrand, AuthHero } from '@/components/layout/auth-shell'

export default function LoginPage() {
  return (
    <Suspense fallback={<CenterSpinner />}>
      <LoginPageInner />
    </Suspense>
  )
}

const LOGIN_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Role-based access control',
    description: 'Granular permissions per server and application — no shared root logins.',
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

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'
  const login = useAuthStore((s) => s.login)
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const emailRef = useRef(null)

  useEffect(() => {
    if (!loading && user) router.replace(next)
  }, [loading, user, router, next])

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!email.trim()) errs.email = 'Email is required'
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errs.email = 'Enter a valid email'
    if (!password) errs.password = 'Password is required'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    try {
      await login({ email: email.trim(), password })
      showToast.success('Welcome back')
      router.replace(next)
    } catch (err) {
      setErrors({ password: err?.message || 'Failed to sign in' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      hero={
        <AuthHero
          eyebrow="Sign in"
          headline="Welcome back to Central Panel"
          subtitle="Manage every connected server, your team, and your audit log from one place."
          features={LOGIN_FEATURES}
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
              Sign in
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Use your Central Panel account email and password.
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-300/80 leading-relaxed">
              Demo mode. Accounts live in this browser only. Register first if you haven't yet.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FieldShell
              label="Email"
              htmlFor="email"
              error={errors.email}
            >
              <Input
                ref={emailRef}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className="h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </FieldShell>

            <FieldShell
              label="Password"
              htmlFor="password"
              error={errors.password}
            >
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className="h-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </FieldShell>

            <Button type="submit" loading={submitting} className="w-full mt-2" size="lg">
              <LogIn className="h-4 w-4" />
              Sign in
            </Button>
          </form>
        </CardContent>
        <div className="px-6 sm:px-8 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-center text-sm text-slate-600 dark:text-slate-400">
          Don't have an account?{' '}
          <Link
            href="/register"
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            Create one
          </Link>
        </div>
      </Card>
    </AuthShell>
  )
}

function FieldShell({ label, htmlFor, error, children }) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-slate-700 dark:text-slate-300 block"
      >
        {label}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

function CenterSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400 dark:text-slate-500" />
    </div>
  )
}