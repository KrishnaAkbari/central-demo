// Shared helper for the "Try it with demo data" onboarding path.
// Writes 1 provider (Vultr), 5 mock servers (1 at risk, 1 warning, 3
// healthy), and 2 audit events directly to localStorage using the same
// shape listServers / listProviders / listAudit return. The page then
// hard-reloads so route data re-reads localStorage and switches from
// the empty state to the populated view.
// Used by /dashboard empty state and /servers empty state.
export function seedDemoData() {
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
    id: providerId, orgId, provider: 'vultr', label: 'Demo · Vultr',
    apiKey: 'DEMO-DO-NOT-USE', createdAt: now, lastSyncAt: now,
  }
  const existingProviders = JSON.parse(window.localStorage.getItem('cp_providers') || '[]')
  window.localStorage.setItem('cp_providers', JSON.stringify([
    ...existingProviders.filter((p) => p.id !== providerId), provider,
  ]))
  const servers = [
    { id: 'demo_cache_01', name: 'cache-01', hostname: 'cache-01.fra1.example.com',
      region: 'fra1', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 95 }, memory: { usedMb: 3800, totalMb: 4000 },
      connectedAt: now, connectedById: userId },
    { id: 'demo_db_01', name: 'db-01', hostname: 'db-01.nyc3.example.com',
      region: 'nyc3', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 78 }, memory: { usedMb: 3300, totalMb: 4000 },
      connectedAt: now, connectedById: userId },
    { id: 'demo_web_01', name: 'web-01', hostname: 'web-01.nyc3.example.com',
      region: 'nyc3', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 45 }, memory: { usedMb: 1150, totalMb: 4000 },
      connectedAt: now, connectedById: userId },
    { id: 'demo_api_01', name: 'api-01', hostname: 'api-01.sfo2.example.com',
      region: 'sfo2', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 12 }, memory: { usedMb: 800, totalMb: 4000 },
      connectedAt: now, connectedById: userId },
    { id: 'demo_worker_01', name: 'worker-01', hostname: 'worker-01.fra1.example.com',
      region: 'fra1', orgId, providerId, source: 'provider', status: 'connected',
      cpu: { loadPct: 22 }, memory: { usedMb: 950, totalMb: 4000 },
      connectedAt: now, connectedById: userId },
  ]
  const existingServers = JSON.parse(window.localStorage.getItem('cp_servers') || '[]')
  const demoIds = new Set(servers.map((s) => s.id))
  window.localStorage.setItem('cp_servers', JSON.stringify([
    ...existingServers.filter((s) => !demoIds.has(s.id)), ...servers,
  ]))
  const audit = [
    { id: 'demo_audit_1', action: 'server.create', actorEmail: userEmail,
      target: 'cache-01', at: new Date(Date.now() - 3600_000).toISOString(), orgId },
    { id: 'demo_audit_2', action: 'provider.connect', actorEmail: userEmail,
      target: 'Vultr (Demo)', at: new Date(Date.now() - 86_400_000).toISOString(), orgId },
  ]
  const existingAudit = JSON.parse(window.localStorage.getItem('cp_audit') || '[]')
  const demoAuditIds = new Set(audit.map((a) => a.id))
  window.localStorage.setItem('cp_audit', JSON.stringify([
    ...existingAudit.filter((a) => !demoAuditIds.has(a.id)), ...audit,
  ]))
}
export function seedDemoDataAndReload() {
  seedDemoData()
  if (typeof window !== 'undefined') window.location.reload()
}