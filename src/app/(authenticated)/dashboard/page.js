'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Server as ServerIcon, Plus, Users as UsersIcon, Building2,
  Activity, Cloud, CheckCircle2, ArrowRight,
  Cpu, MemoryStick, ShieldCheck, Sparkles,
  ScrollText, ChevronRight, Eye, Beaker, Layers,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { StatRow, StatTile } from '@/components/primitives/StatRow'

import { useAuthStore } from '@/stores/authStore'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useCan, useCurrentMemberRole } from '@/hooks/useCan'
import * as api from '@/services/centralApi'
import { getActorColor, getActorInitials } from '@/utils/avatar-utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/utils'

function classifyHealth(server) {
  const cpu = server?.cpu?.loadPct ?? 0
  const memPct = server?.memory?.totalMb
    ? Math.round(((server.memory.usedMb || 0) / server.memory.totalMb) * 100)
    : 0
  if (cpu >= 90 || memPct >= 95) return 'error'
  if (cpu >= 70 || memPct >= 80) return 'warning'
  return 'healthy'
}

const HEALTH_META = {
  healthy: { dot: 'bg-emerald-500', label: 'healthy' },
  warning: { dot: 'bg-amber-500',   label: 'warning' },
  error:   { dot: 'bg-red-500',     label: 'error' },
}

const AUDIT_META = {
  'server.create':        { variant: 'success', label: 'created' },
  'server.delete':        { variant: 'destructive', label: 'deleted' },
  'server.update':        { variant: 'info', label: 'updated' },
  'server.share.grant':   { variant: 'indigo', label: 'shared' },
  'server.share.revoke':  { variant: 'warning', label: 'revoked' },
  'login':                { variant: 'success', label: 'signed in' },
  'logout':               { variant: 'info', label: 'signed out' },
  'org.create':           { variant: 'success', label: 'org created' },
  'org.switch':           { variant: 'info', label: 'org switched' },
  'member.invite':        { variant: 'indigo', label: 'invited' },
  'member.remove':        { variant: 'destructive', label: 'removed' },
  'provider.connect':     { variant: 'success', label: 'connected' },
  'provider.disconnect':  { variant: 'warning', label: 'disconnected' },
}

function healthSummary(servers) {
  const counts = { healthy: 0, warning: 0, error: 0 }
  for (const s of servers) counts[classifyHealth(s)] += 1
  return counts
}

function formatRole(role) {
  if (!role) return 'Owner'
  return role.title || role.name || 'Member'
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}

// Seed demo data for the onboarding "try it" path. Writes 1 provider,
// 5 mock servers (1 at risk, 1 warning, 3 healthy), and 1 audit event
// directly to localStorage using the same shape listServers /
// listProviders / listAudit return. The user can then explore the
// populated dashboard, see what banners, badges, and trends look like,
// and roll back by deleting the entries from Settings.
function seedDemoData() {
  if (typeof window === 'undefined') return
  const orgId = window.localStorage.getItem('cp_active_org')
  const authRaw = window.localStorage.getItem('cp_auth')
  if (!orgId || !authRaw) return

  let auth
  try { auth = JSON.parse(authRaw) } catch { return }
  const userId = auth?.userId
  const userEmail = auth?.userEmail || 'demo@central.local'

  const now = new Date().toISOString()
  const providerId = 'demo_provider_vultr'
  const provider = {
    id: providerId,
    orgId,
    provider: 'vultr',
    label: 'Demo · Vultr',
    apiKey: 'DEMO-DO-NOT-USE',
    createdAt: now,
    lastSyncAt: now,
  }
  const existingProviders = JSON.parse(window.localStorage.getItem('cp_providers') || '[]')
  const nextProviders = [
    ...existingProviders.filter((p) => p.id !== providerId),
    provider,
  ]
  window.localStorage.setItem('cp_providers', JSON.stringify(nextProviders))

  const servers = [
    {
      id: 'demo_cache_01', name: 'cache-01', hostname: 'cache-01.fra1.example.com',
      region: 'fra1', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 95 }, memory: { usedMb: 3800, totalMb: 4000 },
      connectedAt: now, connectedById: userId,
    },
    {
      id: 'demo_db_01', name: 'db-01', hostname: 'db-01.nyc3.example.com',
      region: 'nyc3', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 78 }, memory: { usedMb: 3300, totalMb: 4000 },
      connectedAt: now, connectedById: userId,
    },
    {
      id: 'demo_web_01', name: 'web-01', hostname: 'web-01.nyc3.example.com',
      region: 'nyc3', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 45 }, memory: { usedMb: 1150, totalMb: 4000 },
      connectedAt: now, connectedById: userId,
    },
    {
      id: 'demo_api_01', name: 'api-01', hostname: 'api-01.sfo2.example.com',
      region: 'sfo2', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 12 }, memory: { usedMb: 800, totalMb: 4000 },
      connectedAt: now, connectedById: userId,
    },
    {
      id: 'demo_worker_01', name: 'worker-01', hostname: 'worker-01.fra1.example.com',
      region: 'fra1', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 22 }, memory: { usedMb: 950, totalMb: 4000 },
      connectedAt: now, connectedById: userId,
    },
  ]
  const existingServers = JSON.parse(window.localStorage.getItem('cp_servers') || '[]')
  const demoIds = new Set(servers.map((s) => s.id))
  const nextServers = [
    ...existingServers.filter((s) => !demoIds.has(s.id)),
    ...servers,
  ]
  window.localStorage.setItem('cp_servers', JSON.stringify(nextServers))

  const audit = [
    {
      id: 'demo_audit_1', action: 'server.create', actorEmail: userEmail,
      target: 'cache-01', at: new Date(Date.now() - 3600_000).toISOString(),
      orgId,
    },
    {
      id: 'demo_audit_2', action: 'provider.connect', actorEmail: userEmail,
      target: 'Vultr (Demo)', at: new Date(Date.now() - 86_400_000).toISOString(),
      orgId,
    },
  ]
  const existingAudit = JSON.parse(window.localStorage.getItem('cp_audit') || '[]')
  const demoAuditIds = new Set(audit.map((a) => a.id))
  const nextAudit = [
    ...existingAudit.filter((a) => !demoAuditIds.has(a.id)),
    ...audit,
  ]
  window.localStorage.setItem('cp_audit', JSON.stringify(nextAudit))
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const activeOrgId = useOrganizationStore((s) => s.activeOrgId)
  const organizations = useOrganizationStore((s) => s.organizations)
  const memberRole = useCurrentMemberRole()
  const canViewMembers = useCan('organization.members.view')
  const canManageServers = useCan('organization.servers.manage')
  const canViewAudit = useCan('organization.audit.view')

  const [servers, setServers] = useState([])
  const [members, setMembers] = useState([])
  const [teams, setTeams] = useState([])
  const [audit, setAudit] = useState([])
  const [providersCount, setProvidersCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const [s, m, t, a, p] = await Promise.all([
          api.listServers(),
          api.listMembers().catch(() => []),
          api.listOrganizationsForUser().catch(() => []),
          api.listAudit().catch(() => []),
          api.listProviders().catch(() => []),
        ])
        if (!cancelled) {
          setServers(s)
          setMembers(m)
          setTeams(t)
          setAudit(a)
          setProvidersCount(p.length)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeOrgId])

  const activeOrg = organizations.find((o) => o.id === activeOrgId)
  const orgName = activeOrg?.name || 'Organization'
  const firstName = (user?.name || user?.email?.split('@')[0] || 'there').split(' ')[0]

  const health = healthSummary(servers)
  const auditLast24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return audit.filter((e) => new Date(e.at).getTime() >= cutoff).length
  }, [audit])

  const recentAudit = useMemo(() => {
    return [...audit]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 5)
  }, [audit])

  const recommendation = useMemo(() => {
    // Predictive: surface at-risk servers before anything else
    const atRisk = servers.filter((s) => {
      const h = classifyHealth(s)
      return h === 'warning' || h === 'error'
    })
    if (atRisk.length > 0) {
      const top = atRisk[0]
      const cpu = top?.cpu?.loadPct ?? 0
      const memPct = top?.memory?.totalMb
        ? Math.round(((top.memory.usedMb || 0) / top.memory.totalMb) * 100)
        : 0
      const reason = cpu >= 90 || memPct >= 95
        ? `cpu ${cpu}% or memory ${memPct}%`
        : `cpu ${cpu}% and memory ${memPct}%`
      return {
        kind: 'next',
        icon: Activity,
        accent: cpu >= 90 || memPct >= 95 ? 'red' : 'amber',
        title: atRisk.length === 1
          ? `1 server needs attention`
          : `${atRisk.length} servers need attention`,
        body: `${top.name} is at risk (${reason}). Open the health list to inspect, or jump straight to it.`,
        cta: { label: `Open ${top.name}`, href: `/servers/${top.id}` },
      }
    }
    if (providersCount === 0) {
      return {
        kind: 'next',
        icon: Cloud,
        accent: 'sky',
        title: 'Connect a cloud provider',
        body: servers.length === 0
          ? 'Create your first server in about 5 minutes. Pick from 4 providers or use your own VPS.'
          : `Your ${servers.length} server${servers.length === 1 ? '' : 's'} ${servers.length === 1 ? 'is' : 'are'} connected manually. Connect a provider to streamline future additions.`,
        cta: { label: 'Connect a provider', href: '/integrations' },
      }
    }
    if (members.length <= 1) {
      return {
        kind: 'next',
        icon: UsersIcon,
        accent: 'amber',
        title: 'Invite a member',
        body: "You're the only member here. Add another person so they can help manage servers.",
        cta: { label: 'Open members', href: '/members' },
      }
    }
    return { kind: 'status' }
  }, [providersCount, members.length, servers])

  if (!loading && servers.length === 0) {
    return (
      <OnboardingPanel
        user={user}
        hasProviders={providersCount > 0}
        canManageServers={canManageServers}
      />
    )
  }

  return (
    <PageContainer size="lg">
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${firstName}`}
        description={
          <>
            <span className="font-medium text-slate-700 dark:text-slate-200">{orgName}</span>
            <span className="mx-1.5 text-slate-400 dark:text-slate-500">·</span>
            <span>{formatRole(memberRole)}</span>
            <span className="mx-1.5 text-slate-400 dark:text-slate-500">·</span>
            <span>{servers.length === 1 ? '1 server connected' : `${servers.length} servers connected`}</span>
          </>
        }
      >
        {providersCount === 0 && canManageServers && (
          <Link href="/integrations">
            <Button variant="outline" className="gap-2">
              <Cloud className="h-4 w-4" />
              Add provider
            </Button>
          </Link>
        )}
        {canManageServers && (
          <Link href="/servers/add/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Server
            </Button>
          </Link>
        )}
      </PageHeader>

      {/* Recommendation banner — moved to the top so the most
          actionable alert (at-risk servers, missing provider, solo
          member) is the first thing the user sees. When status is
          'all good' (kind === 'status') nothing renders here and the
          page falls back to the original greeting → checklist → grid
          order. The At-risk panel in the right column stays as the
          complementary detail view (shows ALL at-risk servers vs the
          banner's top one). */}
      {recommendation.kind !== 'status' && (
        <RecommendationBanner recommendation={recommendation} />
      )}

      {!loading && (
        <FirstRunChecklist
          hasProviders={providersCount > 0}
          serverCount={servers.length}
          memberCount={members.length}
        />
      )}



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card elevated className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ServerIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Server health
              <span className="ml-1 text-2xs font-medium text-slate-500 dark:text-slate-400">
                · {servers.length === 0 ? '0 connected' : `${health.healthy + health.warning + health.error} total`}
              </span>
            </h2>
            <Link
              href="/servers"
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
            >
              View all
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ServerHealthList servers={servers} loading={loading} />
        </Card>

        <AtRiskOrStatusPanel
          servers={servers}
          health={health}
          recommendation={recommendation}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {servers.length === 0 && !loading ? (
          <StatTile
            label="Servers"
            icon={ServerIcon}
            tone="indigo"
            href="/servers/add/create"
            cta={{ label: 'Connect your first server' }}
          />
        ) : (
          <StatTile
            label="Servers"
            value={servers.length}
            icon={ServerIcon}
            tone={health.error > 0 ? 'red' : health.warning > 0 ? 'amber' : 'indigo'}
            loading={loading}
            href="/servers"
            subline={!loading && servers.length > 0 ? (
              <HealthSubline health={health} />
            ) : null}
            trend={!loading && servers.length > 0 ? {
              direction: health.error > 0 ? 'down' : 'up',
              value: health.error > 0 ? `${health.error} at risk` : `${health.healthy} healthy`,
              tone: health.error > 0 ? 'bad' : 'good',
            } : null}
          />
        )}
        {canViewMembers && (
          <StatTile
            label="Members"
            value={members.length}
            icon={UsersIcon}
            tone="emerald"
            loading={loading}
            href="/members"
            subline={!loading && members.length > 1 ? `${members.length - 1} other than you` : null}
            trend={!loading && members.length > 0 ? {
              direction: 'up',
              value: members.length > 1 ? `+${members.length - 1}` : 'just you',
              tone: 'good',
            } : null}
          />
        )}
        <StatTile
          label="Organization"
          value={orgName}
          icon={Building2}
          tone="amber"
          loading={loading}
          href="/organizations"
          subline={!loading && (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              {formatRole(memberRole)}
              {teams.length > 1 && <span className="text-slate-400 dark:text-slate-500"> · {teams.length} total</span>}
            </span>
          )}
        />
        <StatTile
          label="Activity (24h)"
          value={auditLast24h}
          icon={Activity}
          tone="slate"
          loading={loading}
          href="/audit"
          subline={!loading && auditLast24h === 0 ? 'No events today' : null}
          trend={!loading && auditLast24h > 0 ? {
            direction: 'up',
            value: `+${auditLast24h}`,
            tone: 'good',
          } : null}
        />
      </div>

      {canViewAudit && (
        <Card elevated className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Recent activity
            </h2>
            <Link
              href="/audit"
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
            >
              View full audit log
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <RecentActivityList events={recentAudit} loading={loading} />
        </Card>
      )}
    </PageContainer>
  )
}

function HealthSubline({ health }) {
  const parts = [
    <span key="h" className="text-emerald-600 dark:text-emerald-400 font-medium">
      {health.healthy} healthy
    </span>,
  ]
  if (health.warning > 0) {
    parts.push(
      <span key="sep1" className="mx-1 text-slate-300 dark:text-slate-600">·</span>,
      <span key="w" className="text-amber-600 dark:text-amber-400 font-medium">
        {health.warning} warning
      </span>,
    )
  }
  if (health.error > 0) {
    parts.push(
      <span key="sep2" className="mx-1 text-slate-300 dark:text-slate-600">·</span>,
      <span key="e" className="text-red-600 dark:text-red-400 font-medium">
        {health.error} error
      </span>,
    )
  }
  return <>{parts}</>
}

function ServerHealthList({ servers, loading }) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 px-1">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-3 w-16 hidden sm:block" />
            <Skeleton className="h-3 w-16 hidden sm:block" />
          </div>
        ))}
      </div>
    )
  }

  const sorted = [...servers]
    .map((s) => ({ s, health: classifyHealth(s) }))
    .sort((a, b) => {
      const order = { error: 0, warning: 1, healthy: 2 }
      return order[a.health] - order[b.health]
    })
    .slice(0, 5)

  if (sorted.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">No servers yet</p>
        <Link href="/servers/add/create" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1 inline-block">
          Connect your first server →
        </Link>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {sorted.map(({ s, health }) => (
        <ServerHealthRow key={s.id} server={s} health={health} />
      ))}
    </div>
  )
}

function ServerHealthRow({ server, health }) {
  const meta = HEALTH_META[health]
  const cpu = server?.cpu?.loadPct ?? 0
  const memPct = server?.memory?.totalMb
    ? Math.round(((server.memory.usedMb || 0) / server.memory.totalMb) * 100)
    : 0

  const cpuColor = cpu >= 90 ? 'bg-red-500' : cpu >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
  const memColor = memPct >= 95 ? 'bg-red-500' : memPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'

  // Predictive: row visually calls out at-risk servers instead of
  // relying on the user to read the CPU/MEM numbers.
  const isAtRisk = health === 'warning' || health === 'error'
  const rowAccent = health === 'error'
    ? 'border-l-2 border-l-red-500/70 bg-red-50/30 dark:bg-red-500/[0.04]'
    : health === 'warning'
    ? 'border-l-2 border-l-amber-500/70 bg-amber-50/30 dark:bg-amber-500/[0.04]'
    : ''

  return (
    <Link
      href={`/servers/${server.id}`}
      className={cn(
        'block px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
        rowAccent
      )}
    >
      <div className="flex items-center gap-4">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${meta.dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900 dark:text-white truncate">{server.name}</p>
            {isAtRisk && (
              <Badge
                variant={health === 'error' ? 'error' : 'warning'}
                className="inline-flex h-4 sm:h-5 px-1 sm:px-1.5 text-[9px] sm:text-xxs uppercase tracking-wider"
              >
                {health === 'error' ? 'attention' : 'warning'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {server.hostname} · {server.region || '—'}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <MiniBar icon={Cpu} label="CPU" value={cpu} fillClass={cpuColor} />
          <MiniBar icon={MemoryStick} label="MEM" value={memPct} fillClass={memColor} />
        </div>
      </div>
    </Link>
  )
}

function MiniBar({ icon: Icon, label, value, fillClass }) {
  const safeValue = Math.max(0, Math.min(100, value || 0))
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 text-slate-400 dark:text-slate-500" />
      <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", fillClass)} style={{ width: `${safeValue}%` }} />
      </div>
      <span className="text-2xs tabular-nums text-slate-500 dark:text-slate-400 w-8 text-right">
        {safeValue}%
      </span>
    </div>
  )
}

function RecentActivityList({ events, loading }) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-1">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-64" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">No activity yet</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          Actions you take across Central Panel will show up here.
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {events.map((e, idx) => {
        const meta = AUDIT_META[e.action] || { variant: 'info', label: e.action }
        return (
          <li key={e.id || idx} className="px-5 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 hover:pl-6 transition-all duration-150 border-l-2 border-l-transparent hover:border-l-indigo-500/60">
            <div className="flex items-center gap-3">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className={cn('text-2xs font-semibold', getActorColor(e.actorEmail))}>
                  {getActorInitials(e.actorEmail, e.actorEmail)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-900 dark:text-white truncate">
                  <span className="font-medium">{e.actorEmail || 'system'}</span>{' '}
                  <span className="text-slate-500 dark:text-slate-400">{meta.label}</span>{' '}
                  {e.target && e.target !== 'self' && (
                    <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">
                      {e.target}
                    </span>
                  )}
                </p>
                <p className="text-2xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {timeAgo(e.at)}
                </p>
              </div>
              <Badge variant={meta.variant} className="hidden sm:inline-flex">
                {meta.label}
              </Badge>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function SystemStatusCard() {
  return (
    <Card elevated className="p-0 overflow-hidden h-full">
      <div className="p-5 flex flex-col h-full">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="mt-4 flex-1">
          <p className="text-2xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
            System status
          </p>
          <h3 className="mt-1 font-semibold text-slate-900 dark:text-white">Everything looks good</h3>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
            All connected servers are healthy. No action is required.
          </p>
        </div>
        <div className="mt-4">
          <Link href="/audit" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
            View recent activity →
          </Link>
        </div>
      </div>
    </Card>
  )
}

function AtRiskOrStatusPanel({ servers, health, recommendation }) {
  const atRisk = servers
    .map((s) => ({ s, health: classifyHealth(s) }))
    .filter((x) => x.health === 'warning' || x.health === 'error')
    .slice(0, 3)

  if (atRisk.length === 0) {
    return <SystemStatusCard />
  }

  const top = atRisk[0]
  const topIsError = top.health === 'error'
  const ringClass = topIsError
    ? 'border-red-300 dark:border-red-500/30'
    : 'border-amber-300 dark:border-amber-500/30'
  const iconColor = topIsError
    ? 'text-red-600 dark:text-red-400 bg-red-500/10'
    : 'text-amber-600 dark:text-amber-400 bg-amber-500/10'

  return (
    <Card elevated className={cn('p-0 overflow-hidden h-full', ringClass)}>
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className={cn('h-4 w-4', topIsError ? 'text-red-500' : 'text-amber-500')} />
          Needs attention
          <span className="ml-1 text-2xs font-medium text-slate-500 dark:text-slate-400">
            · {atRisk.length} server{atRisk.length === 1 ? '' : 's'}
          </span>
        </h2>
        <Link
          href="/servers"
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
        >
          View
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {atRisk.map(({ s, health }) => {
          const cpu = s?.cpu?.loadPct ?? 0
          const memPct = s?.memory?.totalMb
            ? Math.round(((s.memory.usedMb || 0) / s.memory.totalMb) * 100)
            : 0
          return (
            <li key={s.id}>
              <Link
                href={`/servers/${s.id}`}
                className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <span className={cn(
                  'h-2.5 w-2.5 rounded-full shrink-0 mt-1.5',
                  health === 'error' ? 'bg-red-500' : 'bg-amber-500'
                )} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {s.name}
                  </p>
                  <p className="text-2xs text-slate-500 dark:text-slate-400 tabular-nums">
                    cpu {cpu}% · mem {memPct}%
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <Link
          href={top ? `/servers/${top.s.id}` : '/servers'}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Inspect {top?.s?.name}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  )
}

function RecommendationBanner({ recommendation }) {
  const { icon: Icon, accent, title, body, cta } = recommendation

  const accentClasses = {
    sky:     { ring: 'border-sky-300 dark:border-sky-500/30',     iconColor: 'text-sky-600 dark:text-sky-400 bg-sky-500/10' },
    amber:   { ring: 'border-amber-300 dark:border-amber-500/30', iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
    indigo:  { ring: 'border-indigo-300 dark:border-indigo-500/30', iconColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10' },
    red:     { ring: 'border-red-300 dark:border-red-500/30',     iconColor: 'text-red-600 dark:text-red-400 bg-red-500/10' },
  }[accent] || { ring: 'border-slate-200 dark:border-slate-800', iconColor: 'text-slate-600 dark:text-slate-300 bg-slate-500/10' }

  return (
    <Card elevated className={cn('p-0 overflow-hidden', accentClasses.ring)}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5">
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', accentClasses.iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-2xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
            Recommended next step
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white truncate">
            {title}
          </p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            {body}
          </p>
        </div>
        <Link href={cta.href} className="shrink-0">
          <Button className="gap-2 w-full sm:w-auto">
            {cta.label}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </Card>
  )
}

function RecommendationCard({ recommendation }) {
  const { icon: Icon, accent, title, body, cta } = recommendation

  const accentClasses = {
    sky:     { ring: 'border-sky-200 dark:border-sky-500/30',     bg: 'bg-sky-50 dark:bg-sky-500/10',     iconColor: 'text-sky-600 dark:text-sky-400' },
    amber:   { ring: 'border-amber-200 dark:border-amber-500/30', bg: 'bg-amber-50 dark:bg-amber-500/10', iconColor: 'text-amber-600 dark:text-amber-400' },
    emerald: { ring: 'border-emerald-200 dark:border-emerald-500/30', bg: 'bg-emerald-50 dark:bg-emerald-500/10', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    indigo:  { ring: 'border-indigo-200 dark:border-indigo-500/30', bg: 'bg-indigo-50 dark:bg-indigo-500/10', iconColor: 'text-indigo-600 dark:text-indigo-400' },
  }[accent] || { ring: 'border-slate-200 dark:border-slate-700', bg: 'bg-slate-50 dark:bg-slate-800/50', iconColor: 'text-slate-600 dark:text-slate-300' }

  return (
    <Card elevated className={cn("p-0 overflow-hidden h-full", accentClasses.ring, accentClasses.bg)}>
      <div className="p-5 flex flex-col h-full">
        <div className={cn("h-10 w-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shrink-0", accentClasses.iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="mt-4 flex-1">
          <p className="text-2xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
            Recommended next step
          </p>
          <h3 className="mt-1 font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{body}</p>
        </div>
        <div className="mt-4">
          <Link href={cta.href}>
            <Button className="gap-2 w-full sm:w-auto">
              {cta.label}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}

function OnboardingPanel({ user, hasProviders, canManageServers }) {
  const firstName = (user?.name || user?.email?.split('@')[0] || 'there').split(' ')[0]
  const primaryHref = hasProviders ? '/servers/add/create' : '/integrations'

  const handleSeed = () => {
    seedDemoData()
    // Hard reload so the dashboard route re-reads localStorage
    // and switches from the empty OnboardingPanel to the populated view.
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  return (
    <PageContainer size="lg">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        {/* Left: the value proposition + CTAs */}
        <Card elevated className="lg:col-span-3 p-0 overflow-hidden flex flex-col">
          <div className="px-6 py-8 sm:px-10 sm:py-10 space-y-6 flex-1 flex flex-col">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />
              Welcome to Central Panel
            </div>

            <div>
              <h1 className="text-[24px] sm:text-[24px] font-bold tracking-tight text-slate-900 dark:text-white">
                Manage every server you own, from one place.
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 max-w-xl leading-relaxed">
                Hi {firstName} — Central Panel gives you one dashboard for every Open Source Panel server you run. Live in about 5 minutes.
              </p>
            </div>

            {/* Provider logos inline so the user sees the supported set before any text reads "Vultr, DigitalOcean..." */}
            <div>
              <p className="text-2xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
                Connects to
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {['Vultr', 'DigitalOcean', 'Linode', 'Hetzner'].map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-2xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide"
                  >
                    {p}
                  </span>
                ))}
                <span className="inline-flex items-center rounded-md border border-dashed border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-2xs font-medium text-slate-500 dark:text-slate-400">
                  + any VPS
                </span>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 pt-1">
              {canManageServers && (
                <Link href={primaryHref}>
                  <Button size="lg" className="gap-2 shadow-lg shadow-indigo-500/20">
                    <Plus className="h-5 w-5" />
                    {hasProviders ? 'Create your first server' : 'Connect your first server'}
                  </Button>
                </Link>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <button
                  type="button"
                  onClick={handleSeed}
                  className="inline-flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Beaker className="h-3.5 w-3.5" />
                  Try it with demo data
                </button>
                <Link
                  href="/servers/add/connect"
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  or use a VPS you already own
                </Link>
              </div>
            </div>

            <p className="text-2xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
              Demo build · Your data stays in this browser
            </p>
          </div>
        </Card>

        {/* Right: the "after" state preview */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <Eye className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <p className="text-2xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              What your dashboard will look like
            </p>
          </div>
          <PopulatedStatePreview />
        </div>
      </div>
    </PageContainer>
  )
}

function OnboardingStep({ n, icon: Icon, title, detail }) {
  return (
    <li className="flex items-start gap-4">
      <div className="relative shrink-0">
        <div className="h-9 w-9 rounded-full bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-100 dark:ring-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Icon className="h-4 w-4" />
        </div>
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
          {n}
        </span>
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{detail}</p>
      </div>
    </li>
  )
}

// Static preview of the populated dashboard. Used in the empty state
// to show the user what they are about to build. Pure presentational,
// no live data.
function PopulatedStatePreview() {
  const rows = [
    { name: 'cache-01',  host: 'cache-01.fra1.example.com',  region: 'fra1', cpu: 95, mem: 95, status: 'error' },
    { name: 'db-01',     host: 'db-01.nyc3.example.com',     region: 'nyc3', cpu: 78, mem: 83, status: 'warning' },
    { name: 'web-01',    host: 'web-01.nyc3.example.com',    region: 'nyc3', cpu: 45, mem: 29, status: 'healthy' },
    { name: 'api-01',    host: 'api-01.sfo2.example.com',    region: 'sfo2', cpu: 12, mem: 20, status: 'healthy' },
  ]

  const dotClass = {
    error:   'bg-red-500',
    warning: 'bg-amber-500',
    healthy: 'bg-emerald-500',
  }

  const barClass = {
    error:   'bg-red-500',
    warning: 'bg-amber-500',
    healthy: 'bg-indigo-500',
  }

  return (
    <Card elevated className="p-0 overflow-hidden flex-1 flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
          <ServerIcon className="h-3.5 w-3.5 text-indigo-500" />
          Server health
          <span className="ml-1 text-xxs font-medium text-slate-500 dark:text-slate-400">· 4 total</span>
        </p>
        <span className="text-xxs text-slate-500 dark:text-slate-400">Preview</span>
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800 flex-1">
        {rows.map((r) => (
          <li key={r.name} className="px-4 py-2.5 flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass[r.status]}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                {r.name}
                {(r.status === 'error' || r.status === 'warning') && (
                  <span className={`inline-flex items-center px-1 h-3.5 rounded-sm text-[8px] font-bold uppercase tracking-wider ${
                    r.status === 'error'
                      ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  }`}>
                    {r.status === 'error' ? 'attention' : 'warning'}
                  </span>
                )}
              </p>
              <p className="text-xxs text-slate-500 dark:text-slate-400 truncate">
                {r.region}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <span className="text-xxs tabular-nums text-slate-500 dark:text-slate-400 w-6 text-right">
                {r.cpu}%
              </span>
              <div className="w-10 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full ${barClass[r.status]}`} style={{ width: `${r.cpu}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      {/* Mini recommendation banner — shows the "after" state of the predicted banner */}
      <div className="px-3 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-red-500/[0.04] flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-red-500 shrink-0" />
        <p className="text-2xs text-slate-700 dark:text-slate-300 truncate">
          <span className="font-semibold">2 servers need attention</span>
          <span className="text-slate-500 dark:text-slate-400"> · cache-01 at risk</span>
        </p>
        <ArrowRight className="h-3 w-3 text-red-500 ml-auto shrink-0" />
      </div>
    </Card>
  )
}

// Compact first-run checklist. Shows on the populated dashboard when
// the user has not yet completed all 3 onboarding milestones. Adapts
// to what they've already done (Asana / ClickUp pattern: completed
// steps get checked off automatically).
function FirstRunChecklist({ hasProviders, serverCount, memberCount }) {
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('cp_first_run_dismissed') === '1') {
        setDismissed(true)
      }
    } catch {}
  }, [])
  const steps = useMemo(() => {
    return [
      {
        id: 'provider',
        label: 'Connect a cloud provider',
        done: hasProviders,
        cta: hasProviders ? null : { label: 'Connect', href: '/integrations' },
      },
      {
        id: 'server',
        label: 'Add your first server',
        done: serverCount > 0,
        cta: serverCount > 0 ? null : { label: 'Add server', href: '/servers/add/create' },
      },
      {
        id: 'team',
        label: 'Invite a teammate',
        done: memberCount > 1,
        cta: memberCount > 1 ? null : { label: 'Invite', href: '/members' },
      },
    ]
  }, [hasProviders, serverCount, memberCount])

  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null
  if (dismissed) return null

  const nextStep = steps.find((s) => !s.done)
  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <Card elevated className="p-0 overflow-hidden">
      <div className="px-5 py-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                Getting started
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {doneCount === 0 && 'Three quick steps to your first server'}
                {doneCount === 1 && 'Almost there — one more step'}
                {doneCount === 2 && 'One step left'}
              </p>
            </div>
          </div>
          {nextStep?.cta && (
            <Link href={nextStep.cta.href}>
              <Button size="sm" className="gap-1.5 shrink-0">
                {nextStep.cta.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>

        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {steps.map((s, i) => (
            <li
              key={s.id}
              className={cn(
                'flex items-start gap-2.5 p-3 rounded-lg border',
                s.done
                  ? 'border-emerald-500/30 bg-emerald-500/[0.05]'
                  : s.id === nextStep?.id
                  ? 'border-indigo-500/40 bg-indigo-500/[0.05]'
                  : 'border-slate-200 dark:border-slate-800'
              )}
            >
              <span className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-xxs font-bold shrink-0',
                s.done
                  ? 'bg-emerald-500 text-white'
                  : s.id === nextStep?.id
                  ? 'bg-indigo-500 text-white'
                  : 'border border-slate-300 dark:border-slate-700 text-slate-400'
              )}>
                {s.done ? '✓' : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  'text-xs font-semibold',
                  s.done ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'
                )}>
                  {s.label}
                </p>
                {s.done && (
                  <p className="text-xxs text-emerald-600 dark:text-emerald-400 mt-0.5">Done</p>
                )}
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => {
            // Dismiss the checklist for this session by storing a flag.
            try { window.sessionStorage.setItem('cp_first_run_dismissed', '1') } catch {}
            setDismissed(true)
          }}
          className="self-end text-2xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
        >
          Hide this for now
        </button>
      </div>
    </Card>
  )
}
