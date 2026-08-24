'use client'

import { useEffect, useState } from 'react'
import {
  Cloud, Eye, EyeOff, AlertTriangle, Loader2, Plug,
  Info, Plus,
} from 'lucide-react'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FieldRow } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { showToast } from '@/utils/toast-utils'

import * as api from '@/services/centralApi'

/**
 * ProviderIntegrationsDialog — connect / disconnect cloud provider accounts.
 *
 * Two modes:
 *   1. providerId prop SET (e.g. from the integrations page's per-provider
 *      "+ Connect" button): the dialog opens directly to that provider's
 *      ConnectForm. No list view, no picking — the caller already picked.
 *   2. providerId prop UNSET (e.g. from the Create Server wizard when no
 *      provider is connected): the dialog opens to a "Cloud providers"
 *      list view. Each row has a "+ Connect" button that opens the
 *      ConnectForm inline.
 *
 * In both modes a successful connect fires `onConnected()` so the parent
 * can refresh its own connected list (or wizard state). Disconnect still
 * lives inside this dialog because it needs the server-count guard; rename
 * was moved out to RenameAccountDialog so the integrations page can call
 * it directly from its account-row kebab.
 *
 * Label is REQUIRED on connect — it's the only thing that distinguishes
 * two accounts of the same provider.
 */
export function ProviderIntegrationsDialog({ open, providerId, onOpenChange, onConnected }) {
  const [catalog] = useState(() => api.PROVIDER_CATALOG)
  const [connected, setConnected] = useState([]) // only used in list-view mode
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(null) // list-view → ConnectForm flow
  const [token, setToken] = useState('')
  const [label, setLabel] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(null)
  const [disconnectBusy, setDisconnectBusy] = useState(false)
  const [serverCount, setServerCount] = useState(null)

  const listMode = !providerId
  const activeProviderId = providerId || connecting
  const activeCatalog = activeProviderId ? catalog.find((p) => p.id === activeProviderId) : null

  // Load the connected list only when in list mode (providerId prop unset).
  useEffect(() => {
    if (!open || !listMode) return
    let cancelled = false
    setLoading(true)
    api.listProviders()
      .then((list) => { if (!cancelled) setConnected(list) })
      .catch((err) => { if (!cancelled) showToast.error(err?.message || 'Failed to load providers') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, listMode])

  // Reset transient form state on open / when the target provider changes.
  useEffect(() => {
    if (open) {
      setConnecting(null)
      setToken('')
      setLabel('')
      setError(null)
      setShowToken(false)
      setDisconnecting(null)
      setServerCount(null)
    }
  }, [open, activeProviderId])

  const handleConnect = async () => {
    if (!activeProviderId) return
    setError(null)
    setSubmitting(true)
    try {
      const record = await api.connectProvider({
        provider: activeProviderId,
        label: label.trim(),
        token: token.trim(),
      })
      showToast.success(`${activeCatalog?.name || 'Provider'} connected`)
      setToken('')
      setLabel('')
      setShowToken(false)
      // Refresh internal list (for list mode) and notify parent.
      if (listMode) {
        const list = await api.listProviders().catch(() => null)
        if (list) setConnected(list)
      }
      onConnected?.(record)
      onOpenChange(false)
      return record
    } catch (err) {
      setError(err?.message || 'Failed to connect provider')
    } finally {
      setSubmitting(false)
    }
  }

  const openDisconnect = async (record) => {
    setDisconnecting(record)
    setServerCount(null)
    try {
      const n = await api.countServersUsingProviderAccount(record.id)
      setServerCount(n)
    } catch {
      // Non-fatal: the count is purely informational for the guard.
    }
  }

  const handleDisconnect = async () => {
    if (!disconnecting) return
    setDisconnectBusy(true)
    try {
      await api.disconnectProvider(disconnecting.id)
      const c = catalog.find((p) => p.id === disconnecting.provider)
      showToast.success(`${c?.name || 'Provider'} disconnected`)
      setDisconnecting(null)
      setServerCount(null)
      if (listMode) {
        const list = await api.listProviders().catch(() => null)
        if (list) setConnected(list)
      }
      onConnected?.()
    } catch (err) {
      showToast.error(err?.message || 'Failed to disconnect provider')
    } finally {
      setDisconnectBusy(false)
    }
  }

  const handleOpenChange = (next) => {
    if (next) return
    // Closing — let parent reset its providerId prop if it wants to.
    onOpenChange(false)
  }

  // Group connected records by provider id, preserving catalog order.
  // Only used in list mode.
  const groups = listMode
    ? catalog.map((p) => ({
        provider: p,
        accounts: connected.filter((c) => c.provider === p.id),
      }))
    : []

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          size="lg"
          header={
            <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-4 pr-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
                  <Cloud className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-slate-900 dark:text-white text-xl">
                    {activeCatalog
                      ? `Connect ${activeCatalog.name}`
                      : 'Cloud providers'}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {activeCatalog
                      ? 'Paste a token in the format your provider issues. In this frontend demo the full token is not sent anywhere or stored — only a last-4 preview is kept locally.'
                      : 'Connect as many accounts as you need. Each account can bill for different servers.'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          }
        >
          <div className="px-6 py-5">
            {activeCatalog ? (
              <ConnectForm
                catalog={activeCatalog}
                token={token}
                setToken={setToken}
                label={label}
                setLabel={setLabel}
                showToken={showToken}
                setShowToken={setShowToken}
                error={error}
                submitting={submitting}
                onCancel={() => {
                  if (listMode) {
                    // Back to the picker list.
                    setConnecting(null)
                    setError(null)
                    setToken('')
                    setLabel('')
                  } else {
                    // Direct-connect mode: just close.
                    onOpenChange(false)
                  }
                }}
                onSubmit={handleConnect}
              />
            ) : loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading providers…
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map(({ provider: p, accounts }) => (
                  <section
                    key={p.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="h-9 w-9 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-sm font-bold"
                          aria-hidden
                        >
                          {p.name[0]}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900 dark:text-white truncate">{p.name}</h3>
                            {accounts.length > 0 && (
                              <span className="text-2xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5">
                                {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
                              </span>
                            )}
                          </div>
                          {accounts.length === 0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Not connected
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => setConnecting(p.id)}
                        className="gap-2 px-3.5 shrink-0"
                        data-testid={`add-account-${p.id}`}
                      >
                        <Plus className="h-4 w-4" />
                        Connect
                      </Button>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!disconnecting}
        onOpenChange={(o) => !o && setDisconnecting(null)}
        title="Disconnect account?"
        description={
          disconnecting
            ? serverCount && serverCount > 0
              ? `Can't disconnect — ${serverCount} server${serverCount === 1 ? '' : 's'} still use this account. Reconnect each server to a different account first, then disconnect.`
              : `Disconnect ${catalog.find((p) => p.id === disconnecting.provider)?.name || 'this provider'} account "${disconnecting.label}"? Existing servers created with this account will keep working until they're re-assigned.`
            : ''
        }
        confirmText={serverCount && serverCount > 0 ? 'Got it' : 'Disconnect'}
        variant={serverCount && serverCount > 0 ? 'default' : 'destructive'}
        loading={disconnectBusy}
        onConfirm={() => {
          if (serverCount && serverCount > 0) {
            setDisconnecting(null)
            setServerCount(null)
            return
          }
          handleDisconnect()
        }}
      />
    </>
  )
}

function ConnectForm({ catalog, token, setToken, label, setLabel, showToken, setShowToken, error, submitting, onCancel, onSubmit }) {
  const submit = async () => {
    await onSubmit()
  }

  const canSubmit = token.trim().length > 0 && label.trim().length > 0

  return (
    <div className="space-y-5">
      <Card className="p-4 border-sky-200 dark:border-sky-500/30 bg-sky-50/50 dark:bg-sky-500/5">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xxs font-semibold uppercase tracking-wide bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200">
                Demo only
              </span>
              <span className="text-2xs text-slate-500 dark:text-slate-400">
                Token instructions below apply to the real provider.
              </span>
            </div>
            <p className="text-xs text-sky-900 dark:text-sky-200">
              {catalog.helperText}
            </p>
          </div>
        </div>
      </Card>

      <FieldRow
        label="Account label"
        htmlFor={`prov-label-${catalog.id}`}
        required
        helper="A friendly name so you can tell accounts apart (e.g. 'Production', 'Staging')."
      >
        <Input
          id={`prov-label-${catalog.id}`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={`${catalog.name} — primary`}
          maxLength={48}
          autoFocus
        />
      </FieldRow>

      <FieldRow
        label="API token"
        htmlFor={`prov-token-${catalog.id}`}
        required
        helper={`Format: ${catalog.tokenPrefix}… (demo accepts any string matching the prefix).`}
      >
        <div className="relative">
          <Input
            id={`prov-token-${catalog.id}`}
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={`${catalog.tokenPrefix}${'x'.repeat(20)}`}
            autoComplete="off"
            className="pr-10 font-mono"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 dark:hover:text-white transition-colors"
            aria-label={showToken ? 'Hide token' : 'Show token'}
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </FieldRow>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="outline"  onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="button"
          
          onClick={submit}
          disabled={!canSubmit || submitting}
          loading={submitting}
          className="gap-2"
        >
          <Plug className="h-4 w-4" />
          Connect {catalog.name}
        </Button>
      </div>
    </div>
  )
}