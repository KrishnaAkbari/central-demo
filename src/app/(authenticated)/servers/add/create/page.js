'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Loader2, Plus, Sparkles, ExternalLink, X,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageContainer, PageHeader, PageBreadcrumb } from '@/components/ui/page'
import { showToast } from '@/utils/toast-utils'

import { useCan } from '@/hooks/useCan'
import * as api from '@/services/centralApi'

import { Stepper } from '@/components/servers/CreateServer/Stepper'
import { SourceStep } from '@/components/servers/CreateServer/SourceStep'
import { CustomVpsStep } from '@/components/servers/CreateServer/CustomVpsStep'
import { CloudProviderStep } from '@/components/servers/CreateServer/CloudProviderStep'
import { ConnectExistingStep } from '@/components/servers/CreateServer/ConnectExistingStep'
import { ProvisioningStep } from '@/components/servers/CreateServer/ProvisioningStep'
import { ReadyStep } from '@/components/servers/CreateServer/ReadyStep'

// Wizard stepper. Review was previously a separate step between
// Configure and Install; we removed it because the user just filled in
// the form — a "here's what you typed" screen added a click without
// adding information. The configure step's primary action now advances
// straight to Install. Step index mapping: 0=source, 1=configure, 2=install.
const STEPS = ['Choose source', 'Configure server', 'Installing']

/**
 * /servers/add/create — Create Server wizard (full page, not a modal).
 *
 * Step machine:
 *   0 source        pick Custom VPS or Cloud Provider
 *   1 configure     branch-specific form (CustomVpsStep / CloudProviderStep)
 *   2 review        summary + cost card + Back/Create button (page footer)
 *   3 provisioning  staged progress with 7 stages per branch
 *   (4) ready       success card, Open Server / Add another server
 *
 * The page owns the footer Back/Continue so the layout is consistent across
 * steps; per-step sub-components don't render their own navigation.
 *
 * Soft-cancel: when the user cancels during provisioning we abort the UI
 * side (move back to review) but the createServer promise keeps running in
 * the background. A toast warns the user that the server may still be
 * created — this is honest about the demo's limitations and avoids an
 * in-flight Promise rejection.
 */
export default function CreateServerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const canManage = useCan('organization.servers.manage')

  // Read ?source= so a deep link (e.g. /servers/add/connect redirecting
  // here with ?source=connect_existing, or the empty-state source
  // picker linking with ?source=provider / ?source=custom_vps) lands
  // directly inside the right branch at stepIndex=1 instead of
  // forcing the user to pick again.
  const VALID_SOURCES = ['provider', 'custom_vps', 'connect_existing']
  const urlSource = searchParams?.get('source')
  const initialSource = VALID_SOURCES.includes(urlSource) ? urlSource : null

  const [stepIndex, setStepIndex] = useState(initialSource ? 1 : 0) // 0..2 (Install = 2)
  const [source, setSource] = useState(initialSource) // 'custom_vps' | 'provider' | 'connect_existing'
  const [config, setConfig] = useState(null)
  const [provisioning, setProvisioning] = useState({
    stageStatuses: {},
    failed: null,
    result: null,
    logs: [],
  })
  const [createBusy, setCreateBusy] = useState(false)
  const cancelledRef = useRef(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const startCreate = async () => {
    if (!source || !config) return
    setCreateBusy(true)
    cancelledRef.current = false

    const stages = api.CREATE_STAGES[source]
    const initial = Object.fromEntries(stages.map((s) => [s.id, 'pending']))
    setProvisioning({
      stageStatuses: initial,
      failed: null,
      result: null,
      logs: ['$ central-panel provisioning --source=' + source],
    })

    try {
      const result = await api.createServer({ source, ...config }, (stageId, status) => {
        if (cancelledRef.current) return
        setProvisioning((prev) => {
          const nextLogs = [...prev.logs]
          const stage = stages.find((s) => s.id === stageId)
          if (status === 'active') {
            nextLogs.push(`→ Starting: ${stage?.label || stageId}`)
          } else if (status === 'done') {
            nextLogs.push(`✓ Done: ${stage?.label || stageId}`)
          } else if (status === 'failed') {
            nextLogs.push(`✗ Failed: ${stage?.label || stageId}`)
          }
          return {
            ...prev,
            stageStatuses: { ...prev.stageStatuses, [stageId]: status },
            logs: nextLogs,
          }
        })
      })
      if (cancelledRef.current) {
        // Result still comes back (the API doesn't know we cancelled).
        // Drop it on the floor so we don't navigate the user to the ready
        // step they explicitly abandoned.
        return
      }
      setProvisioning((prev) => ({ ...prev, result }))
    } catch (err) {
      if (cancelledRef.current) return
      setProvisioning((prev) => ({
        ...prev,
        failed: err?.message || 'Provisioning failed',
        logs: [...prev.logs, `✗ Error: ${err?.message || 'Provisioning failed'}`],
      }))
      showToast.error(err?.message || 'Provisioning failed')
    } finally {
      if (!cancelledRef.current) setCreateBusy(false)
    }
  }

  const handleCancel = () => {
    cancelledRef.current = true
    setCreateBusy(false)
    setProvisioning({
      stageStatuses: {},
      failed: null,
      result: null,
      logs: [],
    })
    setStepIndex(1) // back to configure
    showToast.info('Provisioning cancelled. The server may still be created in the background.')
  }

  const handleReset = () => {
    cancelledRef.current = false
    setStepIndex(0)
    setSource(null)
    setConfig(null)
    setProvisioning({ stageStatuses: {}, failed: null, result: null, logs: [] })
    setCreateBusy(false)
  }

  // True when the user has typed/picked anything in the wizard and would
  // lose that work by hitting Cancel. The Cancel button shows a confirm
  // dialog only in this case; from step 0 with no picks it's a no-op
  // exit so the confirm is unnecessary.
  const hasWizardState = !!source || !!config || stepIndex > 0

  const handleWizardCancel = () => {
    if (hasWizardState && !onInstall) {
      setCancelOpen(true)
      return
    }
    router.push('/servers')
  }

  const confirmCancel = () => {
    setCancelOpen(false)
    cancelledRef.current = false
    setProvisioning({ stageStatuses: {}, failed: null, result: null, logs: [] })
    setCreateBusy(false)
    setStepIndex(0)
    setSource(null)
    setConfig(null)
    router.push('/servers')
  }

  if (!canManage) {
    return (
      <PageContainer size="md">
        <PageBreadcrumb items={[{ label: 'Servers', href: '/servers' }, { label: 'Add server' }]} className="mb-1" />
        <Card className="p-10 sm:p-12 text-center">
          <Sparkles className="h-10 w-10 mx-auto text-slate-400 dark:text-slate-500" />
          <h3 className="font-semibold text-slate-900 dark:text-white mt-4">Cannot add servers</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Your role in this organization doesn&apos;t include the permission to add new servers.
          </p>
          <Link href="/servers" className="inline-block mt-4">
            <Button variant="outline" >Back to Servers</Button>
          </Link>
        </Card>
      </PageContainer>
    )
  }

  const isReady = !!provisioning.result
  const isFailed = !!provisioning.failed
  const onInstall = stepIndex === 2 && !isReady

  // Stepper index — 3 when ready (one past last), stays on 2 when failed
  // (so the user knows where they were when it broke).
  const stepperIndex = isReady ? 3 : (isFailed ? 2 : stepIndex)

  // Auto-kick off the install pipeline when the user advances from
  // configure to install. The configure step's onContinue calls
  // setConfig + setStepIndex(2); this effect fires once both have
  // committed, with a clean config object visible. Idempotent: the
  // createBusy / isReady / isFailed guards prevent a re-entry from the
  // Ready state. Not source === 'connect_existing' (that path stays on
  // stepIndex 1 and renders its own self-contained step component).
  useEffect(() => {
    if (
      stepIndex === 2 &&
      source &&
      source !== 'connect_existing' &&
      config &&
      !createBusy &&
      !isReady &&
      !isFailed
    ) {
      startCreate()
    }
    // startCreate is stable enough for this use — it depends only on
    // refs and the api module. We intentionally omit it from deps to
    // avoid re-running on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, source, config])

  return (
    <PageContainer size="md" className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageBreadcrumb
          items={
            stepIndex === 0
              ? [{ label: 'Servers', href: '/servers' }, { label: 'Add server' }]
              : [{ label: 'Servers', href: '/servers' }, { label: 'Add server', href: '/servers/add/create' }, { label: 'Create server' }]
          }
          className="mb-0"
        />
        {/* Cancel — single top-right dismissal point. Confirm dialog only
            appears if the user has picked a source or filled in config. */}
        {!isReady && (
          <button
            type="button"
            onClick={handleWizardCancel}
            data-testid="wizard-cancel"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800/60 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        )}
      </div>

      <PageHeader
        eyebrow={stepIndex === 0 ? 'Servers' : 'Add server'}
        title={
          isReady
            ? 'Server ready'
            : onInstall
              ? 'Installing…'
              : stepIndex === 0
                ? 'Add a server'
                : source === 'connect_existing'
                  ? 'Connect existing install'
                  : 'Create server'
        }
        description={
          isReady
            ? 'Your server is connected to Central Panel. No keys to copy or paste.'
            : onInstall
              ? 'Provisioning is running. You can view raw logs from this page.'
              : stepIndex === 0
                ? null
                : source === 'connect_existing'
                  ? 'Link a server that already runs ServerAvatar Open Source Panel.'
                  : 'Create a new server with ServerAvatar Open Source Panel installed automatically.'
        }
      />

      {/* Outer stepper only makes sense for the install flows. For
          connect_existing the user is doing a single flat form, not a
          multi-stage pipeline — the inner stepper was removed so we hide
          the outer one too. Otherwise the user sees two progress
          indicators that disagree with each other. */}
      {source !== 'connect_existing' && (
        <Card className="p-5">
          <Stepper steps={STEPS} currentIndex={stepperIndex} />
        </Card>
      )}

      <Card className="p-6 sm:p-8">
        {stepIndex === 0 && (
          <SourceStep onPick={(s) => { setSource(s); setStepIndex(1) }} />
        )}
        {stepIndex === 1 && source === 'custom_vps' && (
          <CustomVpsStep
            initial={config}
            onContinue={(payload) => { setConfig(payload); setStepIndex(2) }}
          />
        )}
        {stepIndex === 1 && source === 'provider' && (
          <CloudProviderStep
            initial={config}
            onContinue={(payload) => { setConfig(payload); setStepIndex(2) }}
          />
        )}
        {stepIndex === 1 && source === 'connect_existing' && (
          <ConnectExistingStep />
        )}
        {onInstall && source && config && (
          <ProvisioningStep
            stages={api.CREATE_STAGES[source]}
            statuses={provisioning.stageStatuses}
            failed={provisioning.failed}
            estimate={api.CREATE_ESTIMATES?.[source]}
            source={source}
            logs={provisioning.logs}
            canCancel={createBusy}
            onCancel={handleCancel}
            onRetry={() => {
              setProvisioning({ stageStatuses: {}, failed: null, result: null, logs: [] })
              startCreate()
            }}
          />
        )}
        {isReady && provisioning.result && (
          <ReadyStep
            server={provisioning.result}
            onAddAnother={handleReset}
          />
        )}
      </Card>

      {/* Page footer nav — consistent Back/Continue/Create/Open pattern */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {/* Left: Back or status text */}
        {isReady ? (
          <Button variant="outline"  className="gap-2" onClick={handleReset}>
            <Plus className="h-4 w-4" />
            Add another server
          </Button>
        ) : onInstall ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {provisioning.failed
              ? 'Retrying will restart from the beginning.'
              : createBusy
                ? 'Use Stop setup on the install card to cancel.'
                : 'Click Create to begin provisioning.'}
          </span>
        ) : (
          <Button
            variant="outline"
            
            className="gap-2"
            onClick={() => {
              if (stepIndex > 0 && !isFailed) setStepIndex((i) => i - 1)
              else router.push('/servers')
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            {stepIndex === 0 ? 'Back to servers' : 'Back'}
          </Button>
        )}

        {/* Right: primary action varies by step */}
        {isReady ? (
          <Button
            
            className="gap-2"
            onClick={() => router.push(`/servers/${provisioning.result.id}`)}
          >
            Open Dashboard
            <ExternalLink className="h-4 w-4" />
          </Button>
        ) : onInstall ? (
          !createBusy && !isFailed && !isReady ? (
            <Button  className="gap-2" onClick={startCreate} data-testid="install-start">
              <Sparkles className="h-4 w-4" />
              {source === 'provider' ? 'Create server' : 'Install on this VPS'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : createBusy ? (
            <Button  className="gap-2" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              Provisioning…
            </Button>
          ) : isFailed ? (
            <Button  className="gap-2" onClick={() => {
              setProvisioning({ stageStatuses: {}, failed: null, result: null, logs: [] })
              startCreate()
            }}>
              <Sparkles className="h-4 w-4" />
              Retry
            </Button>
          ) : null
        ) : null}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel server setup?"
        description="Your picks and inputs will be discarded. You can start over from the Servers page at any time."
        confirmText="Yes, cancel"
        cancelText="Keep editing"
        variant="destructive"
        icon={<X className="h-5 w-5" />}
        onConfirm={confirmCancel}
      />
    </PageContainer>
  )
}