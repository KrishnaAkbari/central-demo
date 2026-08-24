'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Cloud, Loader2, AlertTriangle, Plus, Server as ServerIcon,
  CheckCircle2, Circle, Sparkles,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FieldRow } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { showToast } from '@/utils/toast-utils'

import * as api from '@/services/centralApi'
import { ProviderIntegrationsDialog } from '@/components/integrations/ProviderIntegrationsDialog'

// OS description map. Real prod catalogs expose this server-side; for the
// demo we keep a small inline map keyed by OS id so the OS picker can
// show a one-liner under each option. Falls back to a generic note.
const OS_DESCRIPTIONS = {
  'ubuntu-24-04':       'Latest LTS, 5-year support window. Best for new deployments.',
  'ubuntu-22-04':       'Stable LTS, broad package availability. Safe default.',
  'debian-12':          'Lean base, conservative releases. Great for minimal stacks.',
  'linode/ubuntu24.04': 'Latest LTS, 5-year support window. Best for new deployments.',
  'linode/ubuntu22.04': 'Stable LTS, broad package availability. Safe default.',
  'linode/debian12':    'Lean base, conservative releases. Great for minimal stacks.',
}

// "Popular" regions get surfaced first when pre-selecting. Singapore (sgp)
// is the most globally central of the four — best latency for APAC, decent
// for EU/US via peering. Falls back to the first region if none match.
const POPULAR_REGION_IDS = ['sgp', 'sgp1', 'ap-south', 'hel1']

/**
 * CloudProviderStep — provider / region / plan / OS / name / account picker.
 *
 * On entry (or when a new provider is picked) we pre-select defaults:
 * cheapest plan, popular region (or first region), Ubuntu 24.04 LTS, and
 * the single connected account (if any). A live cost footer updates as
 * the user changes plan/region.
 *
 * Multi-account: when the active provider has 2+ accounts, shows an
 * account picker ("Bill to") between provider and region. When only one
 * account exists it's preselected silently.
 */
export function CloudProviderStep({ initial, onContinue }) {
  const [catalog] = useState(() => api.PROVIDER_CATALOG)
  const [connectedProviders, setConnectedProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [providerId, setProviderId] = useState(initial?.providerId || null)
  const [providerAccountId, setProviderAccountId] = useState(initial?.providerAccountId || null)
  const [regionId, setRegionId] = useState(initial?.regionId || null)
  const [planId, setPlanId] = useState(initial?.planId || null)
  const [osId, setOsId] = useState(initial?.osId || null)
  const [name, setName] = useState(initial?.name || '')
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  // When the user clicks an unconnected provider, we open the dialog
  // directly to that provider's connect form (providerId prop) instead
  // of showing the full provider list. This keeps the user in the
  // Create Server flow — they don't have to navigate to /integrations
  // and back. After the connect succeeds, the dialog fires onConnected
  // with the new account record; we auto-select that provider and
  // account here so the wizard continues without an extra click.
  const [pendingProviderId, setPendingProviderId] = useState(null)
  const [didPreselect, setDidPreselect] = useState(!!initial?.providerId)

  const loadConnected = async () => {
    try {
      setLoading(true)
      const list = await api.listProviders()
      setConnectedProviders(list)
    } catch (err) {
      showToast.error(err?.message || 'Failed to load providers')
    } finally {
      setLoading(false)
    }
  }

  // Called by the integrations dialog after a successful connect. We
  // refresh the connected list and, if the connect was launched from
  // this step (pendingProviderId set), auto-select the newly connected
  // provider + account so the wizard continues without an extra click.
  const handleProviderConnected = async (record) => {
    await loadConnected()
    if (!record) return
    setProviderId(record.provider)
    setProviderAccountId(record.id)
    setPlanId(null)
    setRegionId(null)
    setOsId(null)
    // Preserve a custom name; only clear the auto-derived placeholder
    // (e.g. "my-vultr-server") so it gets regenerated for the new
    // provider.
    setName((curr) => {
      if (curr && !/^my-[a-z]+-server$/.test(curr)) return curr
      return ''
    })
    setDidPreselect(false) // re-trigger pre-select for the new provider
  }

  useEffect(() => { loadConnected() }, [])

  const provider = catalog.find((p) => p.id === providerId)
  const providerAccounts = connectedProviders.filter((cp) => cp.provider === providerId)
  const hasMultipleAccounts = providerAccounts.length > 1
  const region = provider?.regions.find((r) => r.id === regionId)
  const plan = provider?.plans.find((p) => p.id === planId)
  const osOption = provider?.osOptions.find((o) => o.id === osId)

  // Pre-select defaults ONCE when a new provider gets picked. Cheapest
  // plan, popular region (or first region), latest LTS OS.
  useEffect(() => {
    if (didPreselect || !provider) return
    const cheapest = provider.plans[0]
    const popular = provider.regions.find((r) => POPULAR_REGION_IDS.includes(r.id)) || provider.regions[0]
    const latestLts = provider.osOptions.find((o) => /ubuntu-24|debian-12/i.test(o.id)) || provider.osOptions[0]
    if (cheapest) setPlanId(cheapest.id)
    if (popular) setRegionId(popular.id)
    if (latestLts) setOsId(latestLts.id)
    setDidPreselect(true)
  }, [provider, didPreselect])

  // Build the config payload that gets handed to the next step
  // (ReviewStep). Resolves the actual account id (single-account is
  // silent), and includes the human-readable label so ReviewStep can
  // show "Production" / "Staging" instead of the raw id suffix.
  const buildConfig = () => {
    const resolvedAccountId = hasMultipleAccounts
      ? providerAccountId
      : (providerAccounts[0]?.id || null)
    const resolvedAccount = providerAccounts.find((a) => a.id === resolvedAccountId)
    return {
      providerId,
      providerAccountId: resolvedAccountId,
      providerAccountLabel: resolvedAccount?.label || null,
      regionId,
      planId,
      osId,
      name,
    }
  }

  // Account picker hides when there's only one account — it's preselected.
  const accountPicked = !hasMultipleAccounts || providerAccountId

  const canContinue =
    !!providerId &&
    accountPicked &&
    !!regionId &&
    !!planId &&
    !!osId &&
    name.trim().length > 0

  // Build a friendly "OS description" with safe fallback.
  const osDescription = useMemo(() => {
    if (!osOption) return null
    return OS_DESCRIPTIONS[osOption.id] || 'A supported Linux distribution.'
  }, [osOption])

  const handleSaveTemplate = () => {
    // In a real app this would POST the config to /api/templates. For the
    // demo we just toast so the user can see the wiring works.
    showToast.success(`Template saved: ${provider?.name} · ${plan?.name} · ${region?.name}`)
  }

  // Live cost footer visibility — only meaningful once at least a plan is
  // picked (so cost is computable).
  const showCostFooter = !!(provider && plan)

  // The "Recommended" pill goes on the middle plan when there's an odd
  // count >= 3, otherwise no pill (single plan = no choice, two plans =
  // user can decide).
  const recommendedPlanIdx = provider && provider.plans.length >= 3 && provider.plans.length % 2 === 1
    ? Math.floor(provider.plans.length / 2)
    : -1

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <FieldRow label="Cloud provider" htmlFor="cp-provider" required>
          {loading ? (
            <div className="h-12 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center px-3 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading providers…
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {catalog.map((p) => {
                const accountsForP = connectedProviders.filter((cp) => cp.provider === p.id)
                const connected = accountsForP.length > 0
                const selected = providerId === p.id
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      if (!connected) {
                        // Open the dialog directly to this provider's
                        // connect form. After success, the dialog fires
                        // onConnected and we auto-select the new
                        // provider + account.
                        setPendingProviderId(p.id)
                        setIntegrationsOpen(true)
                        return
                      }
                      setProviderId(p.id)
                      setDidPreselect(false) // re-trigger pre-select for new provider
                      // Pick the single account silently if only one exists.
                      setProviderAccountId(accountsForP.length === 1 ? accountsForP[0].id : null)
                      // Clear selections so pre-select effect picks fresh ones.
                      setPlanId(null)
                      setRegionId(null)
                      setOsId(null)
                      // Reset name only if it looks like an auto-derived
                      // placeholder for the previous provider.
                      setName((curr) => {
                        if (curr && !/^my-[a-z]+-server$/.test(curr)) return curr
                        return ''
                      })
                    }}
                    className={
                      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ' +
                      (selected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 dark:hover:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200')
                    }
                    data-testid={`provider-pick-${p.id}`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                      aria-hidden
                    />
                    <span className="truncate">{p.name}</span>
                    {!connected ? (
                      <span className="ml-auto text-xxs uppercase tracking-wide font-semibold text-amber-600 dark:text-amber-400">
                        Connect
                      </span>
                    ) : accountsForP.length > 1 ? (
                      <span className="ml-auto text-xxs font-semibold text-indigo-600 dark:text-indigo-300">
                        {accountsForP.length}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </FieldRow>

        {connectedProviders.length === 0 && !loading && (
          <Card className="mt-5 p-4 border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-amber-900 dark:text-amber-200">No providers connected</h4>
                <p className="text-xs text-amber-800 dark:text-amber-300/80 mt-1">
                  Connect at least one cloud provider to create a VPS. Central Panel never stores real
                  tokens — the demo uses clearly fake placeholder values.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // "Connect a provider" (the empty-state CTA) opens
                    // the dialog in list mode — the user can pick which
                    // provider to add. The empty state doesn't know
                    // which provider they want, so it can't pre-pick.
                    setPendingProviderId(null)
                    setIntegrationsOpen(true)
                  }}
                  className="mt-3 gap-1.5 border-amber-300 dark:border-amber-500/40"
                >
                  <Plus className="h-4 w-4" />
                  Connect a provider
                </Button>
              </div>
            </div>
          </Card>
        )}

        {provider && hasMultipleAccounts && (
          <div className="mt-5">
            <FieldRow label="Bill to" htmlFor="cp-account" required helper="Pick the account that will be billed for this server. You can connect more from Providers in the sidebar.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {providerAccounts.map((acc) => {
                  const selected = providerAccountId === acc.id
                  return (
                    <button
                      type="button"
                      key={acc.id}
                      onClick={() => setProviderAccountId(acc.id)}
                      className={
                        'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm text-left transition-all ' +
                        (selected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 dark:hover:border-slate-600 bg-white dark:bg-slate-900')
                      }
                      data-testid={`account-pick-${acc.id}`}
                    >
                      <div className="shrink-0">
                        {selected
                          ? <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          : <Circle className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900 dark:text-white truncate">
                          {acc.label}
                        </div>
                        <div className="text-2xs text-slate-500 dark:text-slate-400 truncate font-mono">
                          {acc.tokenPreview}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </FieldRow>
          </div>
        )}

        {provider && (
          <>
            <div className="mt-6">
              <FieldRow label="Region" required>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {provider.regions.map((r) => {
                    const selected = regionId === r.id
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => setRegionId(r.id)}
                        className={
                          'rounded-xl border px-3 py-2.5 text-sm text-left transition-all ' +
                          (selected
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-200'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 dark:hover:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200')
                        }
                        data-testid={`region-pick-${r.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base leading-none">{r.flag}</span>
                          <span className="font-medium truncate">{r.name}</span>
                        </div>
                        <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {r.country}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </FieldRow>
            </div>

            <div className="mt-6">
              <FieldRow label="Server plan" required>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {provider.plans.map((p, idx) => {
                    const selected = planId === p.id
                    const isRecommended = idx === recommendedPlanIdx
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setPlanId(p.id)}
                        className={
                          'relative rounded-xl border p-3 text-left transition-all ' +
                          (selected
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 dark:hover:border-slate-600 bg-white dark:bg-slate-900')
                        }
                        data-testid={`plan-pick-${p.id}`}
                      >
                        {isRecommended && (
                          <span className="absolute -top-2 right-3 inline-flex items-center gap-1 text-xxs uppercase tracking-wider font-semibold text-white bg-indigo-600 rounded-full px-2 py-0.5 shadow-sm">
                            <Sparkles className="h-3 w-3" />
                            Recommended
                          </span>
                        )}
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{p.name}</div>
                        <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1">
                          {p.vcpu} vCPU · {p.ramGb} GB · {p.diskGb} GB SSD
                        </div>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-base font-semibold text-slate-900 dark:text-white tabular-nums">${p.monthlyUsd.toFixed(2)}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">/mo</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </FieldRow>
            </div>

            <div className="mt-6">
              <FieldRow label="Operating system" required helper={osDescription || undefined}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {provider.osOptions.map((o) => {
                    const selected = osId === o.id
                    const isLatestLts = /ubuntu-24|debian-12/i.test(o.id)
                    return (
                      <button
                        type="button"
                        key={o.id}
                        onClick={() => setOsId(o.id)}
                        className={
                          'relative rounded-xl border px-3 py-2.5 text-sm text-left transition-all ' +
                          (selected
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-200'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 dark:hover:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200')
                        }
                        data-testid={`os-pick-${o.id}`}
                      >
                        {isLatestLts && (
                          <span className="absolute -top-2 right-3 inline-flex items-center gap-1 text-xxs uppercase tracking-wider font-semibold text-white bg-indigo-600 rounded-full px-2 py-0.5 shadow-sm">
                            <Sparkles className="h-3 w-3" />
                            Latest LTS
                          </span>
                        )}
                        <div className="font-medium">{o.name}</div>
                        <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {OS_DESCRIPTIONS[o.id] || 'A supported Linux distribution.'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </FieldRow>
            </div>

            <div className="mt-6">
              <FieldRow
                label="Server name"
                htmlFor="cvps-name"
                required
                helper="Name to identify this server in Central Panel."
              >
                <Input
                  id="cvps-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`my-${provider.id}-server`}
                  maxLength={48}
                />
              </FieldRow>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3">
              <label className="flex items-start gap-2.5 cursor-pointer select-none flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-600 dark:bg-slate-800"
                  data-testid="cp-save-template"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">Save as template</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Save this provider · plan · region · OS combo so you can spin up identical
                    servers in two clicks next time.
                  </p>
                </div>
              </label>
              {saveAsTemplate && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSaveTemplate}
                  className="gap-1.5 shrink-0"
                  data-testid="cp-save-template-btn"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Save template
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

      {showCostFooter && (
        <div
          className="sticky bottom-3 z-10 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-lg p-4 flex items-center justify-between gap-4"
          data-testid="cp-cost-footer"
        >
          <div>
            <div className="text-2xs uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Estimated cost
            </div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                ${plan.monthlyUsd.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">/month</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {provider.name} · {plan.vcpu} vCPU · {plan.ramGb} GB · {plan.diskGb} GB SSD
            </div>
          </div>
          <Button
            type="button"
            
            onClick={() => onContinue(buildConfig())}
            disabled={!canContinue}
            className="gap-2"
            data-testid="cp-continue"
          >
            Create server
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!showCostFooter && (
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            
            onClick={() => onContinue(buildConfig())}
            disabled={!canContinue}
            className="gap-2"
            data-testid="cp-continue"
          >
            Create server
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ProviderIntegrationsDialog
        open={integrationsOpen}
        providerId={pendingProviderId}
        onOpenChange={(next) => {
          setIntegrationsOpen(next)
          if (!next) setPendingProviderId(null)
        }}
        onConnected={(record) => handleProviderConnected(record)}
      />
    </div>
  )
}