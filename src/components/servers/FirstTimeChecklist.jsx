'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Sparkles, ArrowRight, Box, Lock, Database, UserPlus, X,
  CheckCircle2, RotateCcw,
} from 'lucide-react'

import { Card } from '@/components/ui/card'

/**
 * FirstTimeChecklist — guided 4-step "what's next" panel for a freshly
 * connected server. Shown above the main actions card, dismissed once
 * all items are completed (or manually via the Dismiss link).
 *
 * Items tick off on click. After all 4 are done, the panel collapses to
 * a single-line "All set" footer with a "Show again" reset link.
 *
 * Completion state is persisted in localStorage under
 * `centralpanel-checklist-${serverId}` so progress survives page
 * reloads and revisits. A user who closes the tab mid-checklist comes
 * back to their progress. Dismissed state is persisted too.
 *
 * Items 1-3 (install app / SSL / backups) live in Open Source Panel,
 * which is where server-level configuration actually happens.
 * Item 4 (invite teammate) is a Central Panel route because
 * membership is organization-scoped, not server-scoped.
 */
export function FirstTimeChecklist({ server }) {
  const storageKey = `centralpanel-checklist-${server.id}`

  const [completed, setCompleted] = useState({})
  const [dismissed, setDismissed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Load from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          if (parsed.completed && typeof parsed.completed === 'object') {
            setCompleted(parsed.completed)
          }
          if (parsed.dismissed) {
            setDismissed(true)
          }
        }
      }
    } catch {
      // localStorage may be unavailable (private mode); ignore silently.
    }
    setHydrated(true)
  }, [storageKey])

  // Persist state changes after hydration completes.
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(storageKey, JSON.stringify({ completed, dismissed }))
    } catch {
      // ignore
    }
  }, [completed, dismissed, hydrated, storageKey])

  const panelUrl = server?.panelUrl

  const items = [
    {
      id: 'app',
      title: 'Install your first application',
      desc: 'Deploy a site or service to make the server useful.',
      href: panelUrl ? `${panelUrl}#applications` : null,
      external: true,
      icon: Box,
    },
    {
      id: 'ssl',
      title: 'Set up SSL',
      desc: 'Secure your applications with free Let\u2019s Encrypt certificates.',
      href: panelUrl ? `${panelUrl}#ssl` : null,
      external: true,
      icon: Lock,
    },
    {
      id: 'backups',
      title: 'Configure backups',
      desc: 'Schedule automated snapshots of this server.',
      href: panelUrl ? `${panelUrl}#backups` : null,
      external: true,
      icon: Database,
    },
    {
      id: 'members',
      title: 'Invite a teammate',
      desc: 'Share access to your Central Panel organization.',
      href: '/members',
      icon: UserPlus,
    },
  ]

  // Hide items whose target isn't available (e.g., panelUrl missing).
  const visibleItems = items.filter((i) => !!i.href)

  const complete = (itemId) => {
    setCompleted((prev) => ({ ...prev, [itemId]: true }))
  }

  const dismiss = () => {
    setDismissed(true)
  }

  const reset = () => {
    setCompleted({})
    setDismissed(false)
  }

  // Collapsed "dismissed" footer — single line + Show again reset link.
  // Don't render until hydration so the panel doesn't flash for non-dismissed users.
  if (dismissed && hydrated) {
    return (
      <Card className="p-3 sm:p-4 flex items-center justify-between gap-3" data-testid="first-time-checklist-done">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span>Get-started checklist dismissed.</span>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:hover:text-white transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Show again
        </button>
      </Card>
    )
  }

  const completedCount = visibleItems.filter((i) => completed[i.id]).length
  const allDone = completedCount === visibleItems.length && visibleItems.length > 0

  return (
    <Card className="p-0 overflow-hidden" data-testid="first-time-checklist">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900 dark:text-white leading-snug">
              {allDone ? 'All set — nice work' : 'Get started with this server'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {allDone
                ? 'You completed every first-time step. Dismiss anytime.'
                : `${completedCount} of ${visibleItems.length} complete \u00b7 a few quick wins below`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800/60 transition-colors shrink-0"
          title="Hide this checklist"
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </button>
      </div>

      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isDone = !!completed[item.id]
          const wrapperProps = item.external
            ? { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
            : { href: item.href }

          return (
            <li
              key={item.id}
              className={
                'flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 transition-colors ' +
                (isDone ? 'bg-emerald-50/40 dark:bg-emerald-500/5' : '')
              }
            >
              <div
                className={
                  'h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors ' +
                  (isDone
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400')
                }
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={
                    'text-sm font-medium leading-snug ' +
                    (isDone ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-white')
                  }
                >
                  {item.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{item.desc}</p>
              </div>
              <Link
                {...wrapperProps}
                onClick={() => complete(item.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 transition-colors shrink-0"
              >
                {item.external ? 'Open' : 'Go'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}