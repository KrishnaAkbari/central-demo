'use client'

import Link from 'next/link'
import {
  ArrowRight, Terminal, Cloud, KeyRound, ListChecks,
} from 'lucide-react'

/**
 * SourcePickerCards — the three source options, shared between the wizard
 * SourceStep (button mode, callback fires onPick) and the /servers empty
 * state (link mode, each card is a Link to the wizard with source preselected).
 *
 * Single source of truth for the three options, so copy and accent stay in
 * sync across both surfaces.
 *
 * Props
 *   onPick  optional. When present, each card renders as a button that
 *           calls onPick(sourceId) on click. When absent, each card renders
 *           as a Link to /servers/add/create?source=sourceId.
 *   className optional extra classes for the grid container.
 */

const SOURCES = [
  {
    id: 'provider',
    icon: Cloud,
    accent: 'sky',
    title: 'Create via Cloud Provider',
    blurb: 'Central Panel provisions a new VPS and installs ServerAvatar automatically.',
    need: 'A connected cloud provider (DigitalOcean, Hetzner, Vultr, Linode)',
    cta: 'Choose provider & plan',
  },
  {
    id: 'custom_vps',
    icon: Terminal,
    accent: 'emerald',
    title: 'Install on my VPS',
    blurb: 'You bring the server. Central Panel connects over SSH and installs ServerAvatar.',
    need: 'Server IP, SSH user, and password',
    cta: 'Enter server details',
  },
  {
    id: 'connect_existing',
    icon: KeyRound,
    accent: 'slate',
    title: 'Connect via Open Source Panel',
    blurb: 'Already running ServerAvatar Open Source Panel on a server? Paste its Server Management Key and Central Panel links to it for monitoring and management — no install or SSH.',
    need: "A Server Management Key from that server's Open Source Panel admin",
    cta: 'Paste a management key',
  },
]

export function SourcePickerCards({ onPick, className = '' }) {
  return (
    <div className={'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-stretch gap-5 ' + className}>
      {SOURCES.map((s) => (
        <SourceCard
          key={s.id}
          {...s}
          onClick={onPick ? () => onPick(s.id) : undefined}
          href={onPick ? undefined : `/servers/add/create?source=${s.id}`}
          testId={`create-source-${s.id === 'custom_vps' ? 'custom' : s.id === 'connect_existing' ? 'connect' : 'provider'}`}
        />
      ))}
    </div>
  )
}

const ACCENT = {
  sky:     { stripe: 'border-l-sky-500',     icon: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400',     cta: 'text-sky-600 dark:text-sky-400' },
  emerald: { stripe: 'border-l-emerald-500', icon: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', cta: 'text-emerald-600 dark:text-emerald-400' },
  slate:   { stripe: 'border-l-slate-400 dark:border-l-slate-500', icon: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200', cta: 'text-slate-700 dark:text-slate-200' },
}

function SourceCard({ icon: Icon, accent, title, blurb, need, cta, onClick, href, testId }) {
  const a = ACCENT[accent] || ACCENT.slate
  const className =
    'group text-left h-full flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 border-l-[3px] ' +
    a.stripe + ' ' +
    'bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 dark:hover:border-slate-600 hover:shadow-md transition-all p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40'

  const content = (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className={'h-10 w-10 rounded-xl ring-1 ring-inset ring-slate-200/70 dark:ring-slate-700/70 flex items-center justify-center ' + a.icon}>
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">{title}</h3>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">
        {blurb}
      </p>

      <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <ListChecks className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="leading-snug"><span className="font-medium text-slate-700 dark:text-slate-300">You need:</span> {need}</span>
        </div>
      </div>

      {/* Pin CTA row to the bottom so cards with shorter body copy still
          align their action baseline with the taller card. mt-auto on a
          flex-col child pushes it to the end of the available height. */}
      <div className={'mt-auto pt-4 flex items-center gap-1.5 text-sm font-medium ' + a.cta}>
        {cta}
        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={className} data-testid={testId}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className} data-testid={testId}>
      {content}
    </button>
  )
}
