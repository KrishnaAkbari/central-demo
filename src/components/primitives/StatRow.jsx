import React from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const TONE_CLASSES = {
  indigo:  { icon: 'from-indigo-500 to-indigo-600',     text: 'text-indigo-700 dark:text-indigo-300',     ring: 'before:bg-indigo-500' },
  emerald: { icon: 'from-emerald-500 to-emerald-600',   text: 'text-emerald-700 dark:text-emerald-300',   ring: 'before:bg-emerald-500' },
  amber:   { icon: 'from-amber-500 to-orange-500',      text: 'text-amber-700 dark:text-amber-300',         ring: 'before:bg-amber-500' },
  rose:    { icon: 'from-rose-500 to-rose-600',         text: 'text-rose-700 dark:text-rose-300',           ring: 'before:bg-rose-500' },
  red:     { icon: 'from-red-500 to-red-600',           text: 'text-red-700 dark:text-red-300',             ring: 'before:bg-red-500' },
  sky:     { icon: 'from-sky-500 to-sky-600',           text: 'text-sky-700 dark:text-sky-300',             ring: 'before:bg-sky-500' },
  violet:  { icon: 'from-violet-500 to-violet-600',     text: 'text-violet-700 dark:text-violet-300',       ring: 'before:bg-violet-500' },
  slate:   { icon: 'from-slate-500 to-slate-600',       text: 'text-slate-700 dark:text-slate-300',         ring: 'before:bg-slate-500' },
  teal:    { icon: 'from-teal-500 to-teal-600',         text: 'text-teal-700 dark:text-teal-300',           ring: 'before:bg-teal-500' },
}

export function StatRow({ tiles, className }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4',
        className
      )}
    >
      {tiles.map((t) => (
        <StatTile key={t.label || t.href || 'tile'} {...t} />
      ))}
    </div>
  )
}

export function StatTile({
  label,
  value,
  icon: Icon,
  dotClass,
  tone = 'slate',
  loading = false,
  subline,
  trend,
  href,
  cta,
}) {
  const cls = TONE_CLASSES[tone] || TONE_CLASSES.slate

  // Accent rail uses `before:` pseudo-element on the Card so we don't need
  // to thread it through Card's prop API for the stat-tile use case. Keeps
  // the primitive encapsulated.
  const body = (
    <Card
      elevated
      interactive={!!href}
      className={cn(
        'relative p-4 sm:p-5 h-full overflow-hidden',
        // Accent rail — 3px colored line at top, tone-driven
        'before:content-[""] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px]',
        cls.ring,
        // CTA state — softer border to invite the click
        cta && 'border-indigo-300 dark:border-indigo-500/40',
      )}
    >
      {/* Subtle gradient wash in top-right corner — tone-driven */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-10 blur-2xl',
          'bg-gradient-to-br',
          cls.icon,
        )}
      />

      <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          {loading ? (
            <Skeleton className="h-9 sm:h-10 w-16 mt-2" />
          ) : cta ? (
            <div className="mt-1.5">
              <p className={cn('text-sm font-medium', cls.text)}>{cta.label}</p>
              {cta.subline && (
                <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">{cta.subline}</p>
              )}
            </div>
          ) : (
            <>
              <p className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {value}
              </p>
              {subline && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subline}</p>
              )}
            </>
          )}
          {trend && !loading && !cta && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              {trend.direction === 'up' ? (
                <ArrowUpRight className={cn('h-3 w-3', cls.text)} />
              ) : trend.direction === 'down' ? (
                <ArrowDownRight className={cn('h-3 w-3', cls.text)} />
              ) : null}
              <span className={cls.text}>{trend.label}</span>
            </div>
          )}
        </div>
        {Icon && !dotClass && !cta && (
          <div
            className={cn(
              'shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center',
              'bg-gradient-to-br shadow-sm',
              cls.icon,
            )}
          >
            <Icon className="h-5 w-5 sm:h-5 sm:w-5 text-white" strokeWidth={2.25} />
          </div>
        )}
        {dotClass && !cta && (
          <div className={cn('shrink-0 h-3 w-3 rounded-full mt-2', dotClass)} />
        )}
        {cta && (
          <div
            className={cn(
              'shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center',
              'bg-gradient-to-br shadow-sm',
              cls.icon,
            )}
          >
            <ArrowRight className="h-5 w-5 text-white" />
          </div>
        )}
      </div>
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {body}
      </Link>
    )
  }
  return body
}