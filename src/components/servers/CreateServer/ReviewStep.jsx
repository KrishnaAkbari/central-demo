'use client'

import {
  ServerCog, Cloud, Globe, Cpu, Server as ServerIcon, Terminal, KeyRound,
  Sparkles, ArrowRight, Pencil, Clock, Wallet,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import * as api from '@/services/centralApi'

/**
 * ReviewStep — read-only summary of the configuration.
 *
 * Layout (top → bottom):
 *   1. Cost card (provider branch only) — dominant at top, big number
 *   2. Configuration summary — each row has an Edit link that jumps back
 *      to the relevant step via onJump.
 *   3. What happens next — 4-phase timeline with time estimates.
 *
 * No Back/Continue buttons — those live on the page footer so the
 * stepper renders above and the user has a single consistent footer.
 */
export function ReviewStep({ source, config, onJump }) {
  const provider = source === 'provider' ? api.PROVIDER_CATALOG.find((p) => p.id === config.providerId) : null
  const region = provider?.regions.find((r) => r.id === config.regionId)
  const plan = provider?.plans.find((p) => p.id === config.planId)
  const osOption = provider?.osOptions.find((o) => o.id === config.osId)
  const accountLabel =
    source === 'provider' && config.providerAccountId
      ? (config.providerAccountLabel || `…${config.providerAccountId.slice(-6)}`)
      : null

  return (
    <div className="space-y-6">
      {source === 'provider' && plan && (
        <Card className="p-6 border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50 via-white to-violet-50/40 dark:from-indigo-500/10 dark:via-slate-900 dark:to-violet-500/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-2xs uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Estimated cost
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-[24px] sm:text-[24px] font-bold text-slate-900 dark:text-white tabular-nums">
                  ${plan.monthlyUsd.toFixed(2)}
                </span>
                <span className="text-base text-slate-500 dark:text-slate-400 font-medium">/month</span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                Billed by <span className="font-semibold text-slate-900 dark:text-white">{provider.name}</span>
                {' · '}
                <span className="tabular-nums">${plan.hourlyUsd.toFixed(4)}/hr</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 max-w-md">
                <Spec icon={Cpu} label="vCPU" value={plan.vcpu} />
                <Spec icon={ServerIcon} label="RAM" value={`${plan.ramGb} GB`} />
                <Spec icon={HardDriveMini} label="Disk" value={`${plan.diskGb} GB`} />
              </div>
            </div>
            <Badge variant="info" size="sm" className="shrink-0">Provider charges apply</Badge>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ServerCog className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            Configuration summary
          </h4>
          <span className="text-xs text-slate-500 dark:text-slate-400">Click any row to edit</span>
        </div>
        <dl className="divide-y divide-slate-100 dark:divide-slate-800">
          {source === 'custom_vps' ? (
            <>
              <EditableRow
                icon={ServerIcon}
                label="Source"
                value="Custom VPS (SSH)"
                onEdit={() => onJump?.(0)}
              />
              <EditableRow
                icon={Globe}
                label="IP address"
                value={config.ip}
                onEdit={() => onJump?.(1)}
              />
              <EditableRow
                icon={Terminal}
                label="SSH"
                value={`${config.user}@${config.ip}:${config.port}`}
                onEdit={() => onJump?.(1)}
              />
              <EditableRow
                icon={ServerIcon}
                label="Server name"
                value={config.name?.trim() || '(will use hostname)'}
                onEdit={() => onJump?.(1)}
              />
              <EditableRow
                icon={KeyRound}
                label="Server Management Key"
                value="Auto-generated and stored securely"
              />
            </>
          ) : (
            <>
              <EditableRow
                icon={Cloud}
                label="Provider"
                value={provider?.name || '—'}
                onEdit={() => onJump?.(0)}
              />
              {accountLabel && (
                <EditableRow
                  icon={Wallet}
                  label="Bill to"
                  value={accountLabel}
                  onEdit={() => onJump?.(1)}
                />
              )}
              <EditableRow
                icon={Globe}
                label="Region"
                value={region ? `${region.flag} ${region.name}, ${region.country}` : '—'}
                onEdit={() => onJump?.(1)}
              />
              <EditableRow
                icon={Cpu}
                label="Plan"
                value={plan ? `${plan.name} (${plan.vcpu} vCPU, ${plan.ramGb} GB, ${plan.diskGb} GB SSD)` : '—'}
                onEdit={() => onJump?.(1)}
              />
              <EditableRow
                icon={ServerIcon}
                label="Operating system"
                value={osOption?.name || '—'}
                onEdit={() => onJump?.(1)}
              />
              <EditableRow
                icon={ServerIcon}
                label="Server name"
                value={config.name?.trim() || '(will use hostname)'}
                onEdit={() => onJump?.(1)}
              />
            </>
          )}
        </dl>
      </Card>

      <Card className="p-6 bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
          What happens next
        </h4>
        <ol className="relative space-y-3">
          <TimelineStep
            n={1}
            title="Create the VPS"
            eta="~30s"
            body={source === 'provider'
              ? `Central Panel calls ${provider?.name || 'the provider'} to spin up a fresh ${plan?.name || 'instance'} in ${region?.name || 'the selected region'}.`
              : 'Skipped — using your existing VPS.'}
          />
          <TimelineStep
            n={2}
            title="Install ServerAvatar"
            eta="~3–5 min"
            body="ServerAvatar services are installed and prepared for Central Panel management."
          />
          <TimelineStep
            n={3}
            title="Establish management access"
            eta="~10s"
            body="Central Panel securely establishes management access. No manual Server Management Key copy is required."
          />
          <TimelineStep
            n={4}
            title="Finalize"
            eta="~10s"
            body="The server appears in your list, dashboard, and audit log with a health snapshot."
          />
        </ol>
      </Card>
    </div>
  )
}

function EditableRow({ icon: Icon, label, value, onEdit }) {
  return (
    <div className="py-2.5 flex items-center gap-3 group">
      <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
      <div className="flex-1 min-w-0 flex items-baseline gap-3">
        <dt className="text-xs uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 w-32 shrink-0">{label}</dt>
        <dd className="text-sm text-slate-900 dark:text-white truncate">{value}</dd>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      )}
    </div>
  )
}

function Spec({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg bg-white/60 dark:bg-slate-800/40 px-3 py-2 ring-1 ring-inset ring-indigo-200/50 dark:ring-indigo-500/20">
      <div className="text-xxs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{value}</div>
    </div>
  )
}

function HardDriveMini(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={'h-3 w-3 ' + (props.className || '')}
    >
      <line x1="22" y1="12" x2="2" y2="12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <line x1="6" y1="16" x2="6.01" y2="16" />
      <line x1="10" y1="16" x2="10.01" y2="16" />
    </svg>
  )
}

function TimelineStep({ n, title, eta, body }) {
  return (
    <li className="flex items-start gap-3">
      <div className="h-7 w-7 rounded-full bg-white dark:bg-slate-900 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-500/30 flex items-center justify-center text-xs font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">
        {n}
      </div>
      <div className="flex-1 min-w-0 -mt-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900 dark:text-white">{title}</span>
          <span className="text-xxs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full px-1.5 py-0.5 tabular-nums">
            {eta}
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{body}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 mt-1.5 shrink-0" />
    </li>
  )
}