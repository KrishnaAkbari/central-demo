'use client'

import { useState } from 'react'
import {
  CheckCircle2, Loader2, AlertTriangle, ChevronDown, ChevronUp,
  Terminal, Square, Sparkles,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CREATE_ESTIMATES } from '@/services/centralApi'

/**
 * ProvisioningStep — staged progress with N stages per branch.
 *
 * The header surfaces three invariants that must always match reality:
 *   - completed stage count (driven directly from `statuses[s.id] === 'done'`)
 *   - progress percentage (Math.round(count / total * 100))
 *   - current stage = the stage with status === 'active', else None
 *
 * Time is NOT shown per-stage. A believable "Estimated time" line is
 * rendered once (sourced from CREATE_ESTIMATES) and stays static — the
 * demo progresses faster than real installation, so per-stage "Est. 1s"
 * or "~1s remaining" copy would look fake. The wizard uses those
 * labels internally for raw-log feedback only.
 *
 * No Back / Cancel buttons — the page footer owns navigation. A failed
 * stage halts and surfaces Retry; the user can also navigate away from
 * the page (no record is persisted until the pipeline finishes).
 */
export function ProvisioningStep({
  stages,
  statuses,
  failed,
  estimate,
  source = 'custom_vps',
  logs = [],
  onRetry,
  onCancel,
  canCancel = false,
}) {
  const [logsOpen, setLogsOpen] = useState(false)
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false)

  const isProvider = source === 'provider'

  const handleStopClick = () => {
    // Provider branch: confirm before stopping. Central Panel may have
    // already created the VPS at the cloud provider; stopping the
    // wizard does not delete it.
    if (isProvider) {
      setStopConfirmOpen(true)
      return
    }
    // Custom VPS: cancellation is purely local — no provider charges.
    if (onCancel) onCancel()
  }

  const handleStopConfirm = () => {
    setStopConfirmOpen(false)
    if (onCancel) onCancel()
  }

  // ---- Invariants: these three numbers are always derived from the
  // raw `statuses` map. They cannot drift relative to each other.
  const total = stages.length
  const completedCount = stages.reduce(
    (n, s) => (statuses[s.id] === 'done' ? n + 1 : n),
    0,
  )
  const activeIndex = stages.findIndex((s) => statuses[s.id] === 'active')
  const failedIndex = stages.findIndex((s) => statuses[s.id] === 'failed')
  const isAllDone = completedCount === total
  const currentStage = activeIndex >= 0 ? stages[activeIndex] : null

  // Pct derived from completedCount. When the loop hasn't marked the
  // first stage active yet, this is 0 — matches reality.
  const pct = isAllDone
    ? 100
    : Math.round((completedCount / total) * 100)

  // Header copy picks one of four states, in priority order:
  //   failed    > active > waiting-to-start > all-done
  let header
  if (failed) {
    const failedAt = failedIndex >= 0
      ? failedIndex + 1
      : Math.min(completedCount + 1, total)
    header = {
      icon: AlertTriangle,
      iconClass: 'text-red-500',
      textClass: 'text-red-700 dark:text-red-300 font-medium',
      text: `Failed at stage ${failedAt} of ${total}`,
    }
  } else if (activeIndex >= 0) {
    header = {
      icon: Loader2,
      iconClass: 'text-indigo-500 dark:text-indigo-400 animate-spin',
      textClass: 'text-slate-700 dark:text-slate-200 font-medium',
      text: `${completedCount} of ${total} complete · ${currentStage.label}`,
    }
  } else if (isAllDone) {
    header = {
      icon: CheckCircle2,
      iconClass: 'text-emerald-500',
      textClass: 'text-emerald-700 dark:text-emerald-300 font-medium',
      text: `${total} of ${total} complete — finishing up`,
    }
  } else {
    header = {
      icon: Sparkles,
      iconClass: 'text-indigo-500 dark:text-indigo-400',
      textClass: 'text-slate-600 dark:text-slate-300',
      text: 'Preparing…',
    }
  }
  const HeaderIcon = header.icon

  const estimateText =
    (estimate && estimate.label) ||
    CREATE_ESTIMATES?.custom_vps?.label ||
    'a few minutes'

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className={`flex items-center gap-1.5 ${header.textClass}`}>
            <HeaderIcon className={`h-3.5 w-3.5 ${header.iconClass}`} />
            <span data-testid="provisioning-status">{header.text}</span>
          </span>
          <span className="tabular-nums text-slate-600 dark:text-slate-300" data-testid="provisioning-pct">
            {pct}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={
              'h-full transition-all duration-500 ' +
              (failed
                ? 'bg-gradient-to-r from-red-400 to-red-500'
                : 'bg-gradient-to-r from-indigo-500 to-violet-500')
            }
            style={{ width: `${failed ? Math.max(pct, 5) : pct}%` }}
            data-testid="provisioning-bar"
          />
        </div>
        <p className="mt-2 text-2xs text-slate-500 dark:text-slate-400">
          Estimated time: <span className="font-medium text-slate-700 dark:text-slate-200">{estimateText}</span>
          {' · '}
          Usually takes a few minutes for a typical install.
        </p>
      </div>

      <ol className="relative space-y-2.5">
        {stages.map((s, idx) => {
          const status = statuses[s.id] || 'pending'
          const isActive = status === 'active'
          const isDone = status === 'done'
          const isFailed = status === 'failed'
          return (
            <li
              key={s.id}
              className={
                'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ' +
                (isActive
                  ? 'border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10'
                  : isDone
                    ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/5'
                    : isFailed
                      ? 'border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900')
              }
            >
              <div className="shrink-0">
                {isDone ? (
                  <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                ) : isActive ? (
                  <div className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : isFailed ? (
                  <div className="h-6 w-6 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-700 dark:text-red-300">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="h-6 w-6 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={
                    'flex items-center gap-2 text-sm font-medium ' +
                    (isDone
                      ? 'text-emerald-900 dark:text-emerald-200'
                      : isActive
                        ? 'text-indigo-900 dark:text-indigo-200'
                        : isFailed
                          ? 'text-red-900 dark:text-red-200'
                          : 'text-slate-700 dark:text-slate-300')
                  }
                >
                  <span className="text-xxs tabular-nums text-slate-400 dark:text-slate-500 w-5">
                    {idx + 1}.
                  </span>
                  <span>{s.label}</span>
                </div>
                {isFailed && failed && (
                  <div className="text-xs text-red-700 dark:text-red-300 mt-0.5">{failed}</div>
                )}
              </div>
              <div className="shrink-0">
                {isDone && (
                  <span className="text-xxs uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/15 rounded-full px-2 py-0.5">
                    Done
                  </span>
                )}
                {isActive && (
                  <span className="text-xxs uppercase tracking-wider font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-500/15 rounded-full px-2 py-0.5">
                    Running
                  </span>
                )}
                {isFailed && (
                  <span className="text-xxs uppercase tracking-wider font-semibold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-500/15 rounded-full px-2 py-0.5">
                    Failed
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setLogsOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white dark:hover:text-white transition-colors"
          data-testid="provisioning-logs-toggle"
        >
          <Terminal className="h-3.5 w-3.5" />
          {logsOpen ? 'Hide raw logs' : 'View raw logs'}
          {logsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {canCancel && !failed && (
          <button
            type="button"
            onClick={handleStopClick}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            data-testid="provisioning-cancel"
          >
            <Square className="h-3 w-3" />
            Stop setup
          </button>
        )}
      </div>

      {logsOpen && (
        <pre
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 dark:bg-slate-50 text-slate-200 text-2xs leading-relaxed p-4 max-h-72 overflow-auto font-mono"
          data-testid="provisioning-logs"
        >
          {logs.length === 0 ? '$ (no output yet)' : logs.join('\n')}
        </pre>
      )}

      {failed && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-5">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-700 dark:text-red-300 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-900 dark:text-red-200">Provisioning failed</p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1 leading-relaxed">
                {failed}
              </p>
              <p className="text-xs text-red-700/80 dark:text-red-300/70 mt-2">
                Retry will restart the pipeline from the first stage. Server records are
                only persisted after the full pipeline completes.
              </p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-1.5 transition-colors"
              data-testid="provisioning-retry"
            >
              <Loader2 className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={stopConfirmOpen}
        onOpenChange={setStopConfirmOpen}
        title="Stop setup?"
        icon={<AlertTriangle className="h-5 w-5" />}
        confirmText="Stop setup"
        onConfirm={handleStopConfirm}
      >
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
          Central Panel will stop tracking this setup and return you to the review step.
        </p>
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200 leading-snug">
          The VPS may continue running and provider charges may still apply.
          Stopping setup does not delete the server at the provider.
        </div>
      </ConfirmDialog>
    </div>
  )
}

// Silence unused-var lint if isPending is ever re-introduced below.
function _isPending(status) {
  return status === 'pending'
}
void _isPending
