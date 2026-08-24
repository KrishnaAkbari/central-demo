'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, Server as ServerIcon, Globe, Cpu, MemoryStick, Cloud,
  ArrowRight, LayoutDashboard, UserPlus, Plus, ExternalLink, Sparkles,
} from 'lucide-react'

import { Card } from '@/components/ui/card'

/**
 * ReadyStep — success state. Server record has been persisted by
 * api.createServer after the pipeline finishes. No key shown.
 *
 * Layout:
 *   1. Success header
 *   2. Server info card
 *   3. Panel URL callout (where to log in)
 *   4. For first-ever install only: a single prominent "Recommended
 *      next step" card replacing the multi-item Next steps row.
 *      For subsequent installs: the regular 4-item Next steps row.
 *
 * The first-time recommendation is gated by a localStorage flag so the
 * user sees it once (or until they dismiss it). After that the standard
 * Next steps row comes back, matching what experienced users expect.
 */
const ONBOARD_FLAG = 'centralpanel-onboarded-install-shown'

export function ReadyStep({ server, onAddAnother }) {
  const [showFirstTimeHint, setShowFirstTimeHint] = useState(false)

  // Read the onboard flag on mount. SSR-safe (this component only renders
  // after the install pipeline finishes, fully client-side).
  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARD_FLAG)) {
        setShowFirstTimeHint(true)
      }
    } catch {
      // localStorage may be unavailable in private mode; show the hint
      // anyway so first-time users in that mode still get guidance.
      setShowFirstTimeHint(true)
    }
  }, [])

  const dismissHint = () => {
    setShowFirstTimeHint(false)
    try {
      localStorage.setItem(ONBOARD_FLAG, 'true')
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center py-6">
        <div className="h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-300 mb-5 ring-4 ring-emerald-50 dark:ring-emerald-500/10">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
          {server?.source === 'provider' ? 'Server is ready' : 'ServerAvatar installed'}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-lg">
          <span className="font-semibold text-slate-900 dark:text-white">{server?.name}</span>{' '}
          is now part of your Central Panel account. ServerAvatar services
          are installed and Central Panel management access is ready to use.
        </p>
      </div>

      <Card className="p-5">
        <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-4">
          Server details
        </h4>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
          <DetailCell icon={ServerIcon} label="Hostname" value={server?.hostname} />
          <DetailCell icon={Globe} label="IP" value={server?.ip} />
          <DetailCell icon={Cpu} label="CPU" value={`${server?.cpu?.cores || '—'} vCPU`} />
          <DetailCell
            icon={MemoryStick}
            label="Memory"
            value={server?.memory ? `${(server.memory.totalMb / 1024).toFixed(0)} GB` : '—'}
          />
          <DetailCell icon={ServerIcon} label="OS" value={server?.os} />
          <DetailCell icon={Cloud} label="Source" value={server?.provider || 'Custom VPS'} />
        </dl>
      </Card>

      {/* Panel URL callout — the most-asked question right after install
          is "where do I log in?". Show the URL prominently with a one-click
          jump, plus a fallback list link to the per-server dashboard. */}
      {server?.panelUrl && (
        <Card className="p-5 border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50/60 to-white dark:from-indigo-500/5 dark:to-slate-900">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <ExternalLink className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-slate-900 dark:text-white">
                Log in to your panel
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                ServerAvatar is now installed on this server. Use this URL to log in
                with the admin credentials you set during install.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={server.panelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                >
                  Open Source Panel
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <code className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate" title={server.panelUrl}>
                  {server.panelUrl}
                </code>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div>
        {showFirstTimeHint ? (
          <FirstTimeRecommendation server={server} onDismiss={dismissHint} />
        ) : (
          <>
            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-3">
              Next steps
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <NextAction
                href={server?.id ? `/servers/${server.id}` : '/servers'}
                icon={ServerIcon}
                label="Open Dashboard"
                hint="View details, run actions"
                primary
              />
              <NextAction
                href="/dashboard"
                icon={LayoutDashboard}
                label="Dashboard"
                hint="See all your servers at a glance"
              />
              <NextAction
                href="/members"
                icon={UserPlus}
                label="Invite Member"
                hint="Add collaborators to this organization"
              />
              <NextAction
                href={onAddAnother ? undefined : '/servers/add/create'}
                icon={Plus}
                label="Add another server"
                hint="Spin up a new VPS"
                onClick={onAddAnother}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DetailCell({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{label}</dt>
      <dd className="text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  )
}

function NextAction({ href, icon: Icon, label, hint, primary, onClick }) {
  const inner = (
    <>
      <div className={
        'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ' +
        (primary
          ? 'bg-indigo-600 text-white'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')
      }>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className={
          'text-sm font-semibold flex items-center gap-1 ' +
          (primary ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-white')
        }>
          {label}
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{hint}</div>
      </div>
    </>
  )
  const className =
    'flex items-center gap-3 rounded-xl border p-3 text-left transition-all ' +
    (primary
      ? 'border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/5 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-sm'
      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 dark:hover:border-slate-600 hover:shadow-sm')

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    )
  }
  return (
    <Link href={href || '#'} className={className}>
      {inner}
    </Link>
  )
}

/**
 * FirstTimeRecommendation — single, prominent CTA shown in place of the
 * regular Next steps row on the very first successful install. One
 * actionable recommendation instead of four equally-weighted options.
 *
 * The user is either guided into the Open Source Panel (the actual
 * place where server-level work happens) or they tap "Not now" to
 * dismiss. Either action sets the onboard flag so the standard
 * Next steps row returns on subsequent installs.
 */
function FirstTimeRecommendation({ server, onDismiss }) {
  const appUrl = server?.panelUrl ? `${server.panelUrl}#applications` : null

  return (
    <Card className="p-6 border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50/60 via-white to-white dark:from-indigo-500/10 dark:via-slate-900 dark:to-slate-900">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 ring-4 ring-indigo-50 dark:ring-indigo-500/10">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-2xs uppercase tracking-wider font-semibold text-indigo-700 dark:text-indigo-300">
            Recommended next step
          </p>
          <h4 className="font-semibold text-slate-900 dark:text-white text-lg mt-0.5 leading-snug">
            Install your first application
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-snug">
            Your server is ready, but it doesn’t run anything yet. Open Open Source
            Panel and deploy your first site or service — the panel walks you
            through choosing a stack, linking a domain, and going live.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {appUrl && (
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onDismiss}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors shadow-sm"
              >
                Install an app
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}
