'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, Server as ServerIcon, KeyRound, Power, Info, HardDrive,
  RefreshCw, X, CheckCircle2, ExternalLink, Copy, Check,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  PageContainer, PageHeader, PageBreadcrumb, LoadingState,
} from '@/components/ui/page'
import { showToast } from '@/utils/toast-utils'

import { useCan } from '@/hooks/useCan'
import * as api from '@/services/centralApi'

import { FirstTimeChecklist } from '@/components/servers/FirstTimeChecklist'
import { ServerAccessCard } from './ServerAccessCard'

export default function ServerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id
  const canView = useCan('organization.servers.view')
  const canManage = useCan('organization.servers.manage')

  const [server, setServer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null) // 'info' | 'disk' | 'restart' | 'disconnect'

  const [infoOpen, setInfoOpen] = useState(false)
  const [info, setInfo] = useState(null)
  const [diskOpen, setDiskOpen] = useState(false)
  const [disk, setDisk] = useState(null)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [ipCopied, setIpCopied] = useState(false)

  const copyIp = async () => {
    if (!server?.ip) return
    try {
      await navigator.clipboard.writeText(server.ip)
      setIpCopied(true)
      showToast.success('IP copied to clipboard')
      setTimeout(() => setIpCopied(false), 1500)
    } catch {
      showToast.error('Could not copy IP')
    }
  }

  const load = useCallback(async () => {
    try {
      const s = await api.getServer(id)
      if (!s) {
        setError('Server not found')
      } else {
        setServer(s)
      }
    } catch (err) {
      setError(err?.message || 'Failed to load server')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleAction = async (name, fn) => {
    setBusy(name)
    try {
      const result = await fn()
      showToast.success(result?.details || name)
      await api.runServerAction(id, name, result?.status || 'ok', result?.serverName || '')
    } catch (err) {
      showToast.error(err?.message || `${name} failed`)
    } finally {
      setBusy(null)
    }
  }

  const onDisconnect = async () => {
    setBusy('disconnect')
    try {
      await api.disconnectServer(id)
      showToast.success('Server disconnected')
      router.push('/servers')
    } catch (err) {
      showToast.error(err?.message || 'Failed to disconnect')
      setBusy(null)
    }
  }

  if (!canView && !loading) {
    return (
      <PageContainer size="sm">
        <PageBreadcrumb items={[{ label: 'Servers', href: '/servers' }, { label: 'Detail' }]} className="mb-1" />
        <Card className="p-10 sm:p-12 text-center">
          <ServerIcon className="h-10 w-10 mx-auto text-slate-400 dark:text-slate-500" />
          <h3 className="font-semibold text-slate-900 dark:text-white mt-4">No access</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            You don't have permission to view servers in this organization.
          </p>
        </Card>
      </PageContainer>
    )
  }

  if (loading) {
    return (
      <PageContainer size="md">
        <LoadingState label="Loading server…" />
      </PageContainer>
    )
  }

  if (error || !server) {
    return (
      <PageContainer size="sm">
        <PageBreadcrumb items={[{ label: 'Servers', href: '/servers' }, { label: 'Detail' }]} className="mb-1" />
        <Card className="p-10 sm:p-12 text-center">
          <h3 className="font-semibold text-slate-900 dark:text-white">{error || 'Server not found'}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">It may have been disconnected.</p>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer size="md">
      <PageBreadcrumb items={[{ label: 'Servers', href: '/servers' }, { label: server.name }]} className="mb-1" />
      <PageHeader
        eyebrow="Servers"
        title={server.name}
        description={null}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success" size="md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block mr-1.5" />
            online
          </Badge>
          {server.panelUrl && (
            <a
              href={server.panelUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open Source Panel — ${server.panelUrl}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-colors text-sm font-medium"
            >
              Open Source
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </PageHeader>

      {/* Server identity strip — hostname and IP shown as separate facts,
          matching the layout on the list cards. IP gets a copy button. */}
      <Card className="p-4">
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Hostname</dt>
            <dd className="font-mono text-slate-900 dark:text-white truncate mt-0.5" title={server.hostname || ''}>
              {server.hostname || '—'}
            </dd>
          </div>
          {server.ip && (
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">IP address</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-slate-900 dark:text-white truncate" title={server.ip}>
                  {server.ip}
                </span>
                <button
                  type="button"
                  onClick={copyIp}
                  title={ipCopied ? 'Copied!' : `Copy IP: ${server.ip}`}
                  aria-label={ipCopied ? 'Copied!' : `Copy IP: ${server.ip}`}
                  className={
                    'shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800/60 transition-colors ' +
                    (ipCopied ? 'text-emerald-600 dark:text-emerald-400' : '')
                  }
                >
                  {ipCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Region</dt>
            <dd className="text-slate-900 dark:text-white mt-0.5">{server.region || '—'}</dd>
          </div>
        </dl>
      </Card>

      <FirstTimeChecklist server={server} />

      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Connected via Server Management Key</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Key <span className="font-mono">{server.keyPreview}</span> · Connected {new Date(server.connectedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <dl className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <DetailField label="Provider" value={server.provider} />
          <DetailField label="Operating System" value={server.os} />
          <DetailField label="Architecture" value={server.arch} />
          <DetailField label="Web Server" value={server.webServer} />
          <DetailField label="PHP Version" value={server.phpVersion} />
          <DetailField label="Node Version" value={server.nodeVersion} />
        </dl>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">Available actions</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            These actions run on the connected server through the Server Management Key.
          </p>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex-col items-start gap-1.5 text-left"
            disabled={!!busy || !canView}
            title={!canView ? "You don't have permission: server.view" : undefined}
            onClick={async () => {
              setBusy('info')
              try {
                const data = await api.runServerAction(id, 'view_server_info', 'ok', `Fetched server info for ${server.name}`)
                setInfo({
                  hostname: server.hostname,
                  kernel: '6.8.0-134-generic',
                  uptime: '4 days, 2 hours',
                  cpuModel: 'Intel Xeon E-2388G',
                  cpuCores: server.cpu?.cores,
                  cpuLoad: server.cpu?.loadPct,
                  memory: server.memory,
                  services: ['nginx 1.24.0', 'php-fpm 8.3', 'mariadb 10.11'],
                  lastBoot: new Date(Date.now() - 4 * 86400 * 1000).toISOString(),
                })
                setInfoOpen(true)
              } catch (err) {
                showToast.error(err?.message || 'Failed')
              } finally {
                setBusy(null)
              }
            }}
          >
            <div className="flex items-center gap-2 w-full">
              {busy === 'info' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Info className="h-4 w-4" />}
              <span className="font-semibold">View Server Info</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Hostname, kernel, CPU, memory, services</p>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex-col items-start gap-1.5 text-left"
            disabled={!!busy || !canView}
            title={!canView ? "You don't have permission: server.view" : undefined}
            onClick={async () => {
              setBusy('disk')
              try {
                const mounts = await api.getServerDiskUsage(id)
                await api.runServerAction(id, 'view_disk_usage', 'ok', `Fetched disk usage for ${server.name}`)
                setDisk(mounts)
                setDiskOpen(true)
              } catch (err) {
                showToast.error(err?.message || 'Failed')
              } finally {
                setBusy(null)
              }
            }}
          >
            <div className="flex items-center gap-2 w-full">
              {busy === 'disk' ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
              <span className="font-semibold">View Disk Usage</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Per-mount disk consumption</p>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex-col items-start gap-1.5 text-left"
            disabled={!!busy || !canManage}
            title={!canManage ? "You don't have permission: server.manage" : undefined}
            onClick={() => setBusy('restart') /* preview; confirm dialog sets real flow */}
          >
            <div className="flex items-center gap-2 w-full">
              <RefreshCw className="h-4 w-4" />
              <span className="font-semibold">Restart Nginx</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">Reload the web server on this server</p>
          </Button>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2">
          {canManage && (
            <Button variant="outline"  className="gap-2" onClick={() => setDisconnectOpen(true)} disabled={!!busy}>
              <Power className="h-4 w-4" />
              Disconnect server
            </Button>
          )}
        </div>
      </Card>

      <ServerAccessCard server={server} />

      <ConfirmDialog
        open={busy === 'restart'}
        onOpenChange={(o) => !o && setBusy(null)}
        title="Restart Nginx?"
        description="This will reload the Nginx web server on the connected server. Any active requests will be dropped. The action runs through the Server Management Key bridge."
        confirmText="Restart"
        variant="default"
        icon={<RefreshCw className="h-5 w-5" />}
        loading={false}
        onConfirm={async () => {
          await handleAction('restart_nginx', async () => {
            await new Promise((r) => setTimeout(r, 600))
            return { status: 'restarted', serverName: server.name, details: `Nginx restarted on ${server.name}` }
          })
        }}
      />

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect this server?"
        description="The server will be removed from your Central Panel account. You can reconnect any time using the same Server Management Key."
        confirmText="Disconnect"
        variant="destructive"
        icon={<Power className="h-5 w-5" />}
        loading={busy === 'disconnect'}
        onConfirm={onDisconnect}
      />

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent
          size="lg"
          header={
            <DialogHeader className="px-6 pt-5">
              <DialogTitle>Server information</DialogTitle>
            </DialogHeader>
          }
        >
          {info && (
            <div className="px-6 py-5 space-y-4">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <DetailField label="Hostname" value={info.hostname} />
                <DetailField label="Kernel" value={info.kernel} />
                <DetailField label="CPU model" value={info.cpuModel} />
                <DetailField label="CPU cores" value={info.cpuCores} />
                <DetailField label="CPU load" value={`${info.cpuLoad}%`} />
                <DetailField label="Memory" value={`${info.memory?.usedMb} MB used of ${info.memory?.totalMb} MB`} />
                <DetailField label="Last boot" value={new Date(info.lastBoot).toLocaleString()} />
                <DetailField label="Uptime" value={info.uptime} />
              </dl>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Running services</p>
                <div className="flex flex-wrap gap-2">
                  {info.services.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={diskOpen} onOpenChange={setDiskOpen}>
        <DialogContent
          size="lg"
          header={
            <DialogHeader className="px-6 pt-5">
              <DialogTitle>Disk usage</DialogTitle>
            </DialogHeader>
          }
        >
          {disk && (
            <div className="px-6 py-5 space-y-3">
              {disk.map((m) => {
                const pct = Math.round((m.usedGb / m.totalGb) * 100)
                const color = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                return (
                  <div key={m.mount} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-700 dark:text-slate-300">{m.mount}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {m.usedGb} GB / {m.totalGb} GB ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xxs text-slate-400 dark:text-slate-500">{m.freeGb} GB free</p>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

function DetailField({ label, value }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-white">{value || '—'}</dd>
    </div>
  )
}