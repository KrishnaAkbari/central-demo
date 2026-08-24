// Central Panel permission catalog.
//
// 3 levels × granular permissions — sourced from
// `src/lib/permissions-data.json` (76 rows: 15 organization, 24
// application, 37 server). Each row carries the production-style
// numeric id (50001-50015 for org, 3621-3644 for app, 3587-5985 for
// server) plus `level`, `sub_level`, `name`, `action`, `order_by`, and
// `allow_parent_ids` (csv of parent numeric ids).
//
// Storage key in cp_roles.permissions is the composite
// `${level}.${name}.${action}` string (e.g. `organization.dashboard.view`,
// `organization.servers.manage`, `server.cronjobs.view`). The composite
// is unique by construction — plain `name` collides across levels
// (`dashboard` exists in all 3) so we cannot use it as a storage key.
//
// `sanitizePermissions` walks each stored key's `allow_parent_ids` chain
// (resolved via numeric `id`) and auto-includes ancestors. Granting
// `organization.servers.manage` therefore pulls in
// `organization.servers.view` (its parent) automatically.
//
// `sub_level` is shown as a small gray label inside the Roles UI so the
// grouping (organization / integration / backup / database / server /
// activity_log) is visible without restructuring the picker layout.

import RAW from './permissions-data.json'

// Build flat PERMISSIONS rows with the composite storage key attached
// as the canonical `name` field. Raw `name` (e.g. `dashboard`) is kept
// as `raw_name` for completeness but the UI / API only ever reads
// `name` (the composite).
const ROWS = []
for (const arr of [RAW.organization, RAW.application, RAW.server]) {
  for (const r of arr) {
    ROWS.push({
      id: r.id,
      name: `${r.level}.${r.name}.${r.action}`,
      raw_name: r.name,
      title: r.title || r.name,
      description: r.description || '',
      level: r.level,
      sub_level: r.sub_level,
      action: r.action,
      order_by: r.order_by,
      allow_parent_ids: r.allow_parent_ids || '',
    })
  }
}

// Sort: by level (organization → application → server), then by order_by.
const LEVEL_ORDER = { organization: 0, application: 1, server: 2 }
export const PERMISSIONS = ROWS.slice().sort((a, b) => {
  const lv = (LEVEL_ORDER[a.level] ?? 99) - (LEVEL_ORDER[b.level] ?? 99)
  if (lv !== 0) return lv
  return a.order_by - b.order_by
})

// Group permissions by level for the picker UI.
export const PERMISSION_LEVELS = PERMISSIONS.reduce((acc, p) => {
  if (!acc[p.level]) acc[p.level] = { label: humanizeLevel(p.level), permissions: [] }
  acc[p.level].permissions.push(p)
  return acc
}, {})

function humanizeLevel(level) {
  return ({
    organization: 'Organization',
    application:  'Applications',
    server:       'Servers',
  })[level] || level
}

// Humanize sub_level for the small label shown inside the Roles UI.
// `level` is the active level tab (organization | application | server);
// some sub_levels (`integration`) need context-aware labels because the
// same code word means different things in different levels
// (e.g. provider in org, cloudflare in app, git/cloud_storage in server).
export function humanizeSubLevel(subLevel, level) {
  if (!subLevel) return ''
  if (subLevel === 'integration') {
    if (level === 'organization') return 'Cloud Providers'
    if (level === 'application')  return 'Cloudflare'
    if (level === 'server')       return 'Integrations'
  }
  return ({
    organization: 'Organization',
    application:  'Application',
    server:       'Server',
    backup:       'Backups',
    database:     'Database Users',
    activity_log: 'Activity Log',
  })[subLevel] || subLevel
}

// All permission storage keys (composite names).
export const ALL_PERMISSION_IDS = PERMISSIONS.map((p) => p.name)
export const ALL_VIEW_IDS       = PERMISSIONS.filter((p) => p.action === 'view').map((p) => p.name)
export const ALL_MANAGE_IDS     = PERMISSIONS.filter((p) => p.action === 'manage').map((p) => p.name)

// Legacy names kept exported for backwards compatibility with
// `seedDefaultRolesForOrg`. Admin = all .manage, Member = all .view.
// These names are now an alias for ALL_MANAGE_IDS / ALL_VIEW_IDS —
// Central Panel no longer has a separate "coarse" tier; the data is
// fully granular and Admin/Member get the full set.
export const COARSE_MANAGE_IDS = ALL_MANAGE_IDS
export const COARSE_VIEW_IDS   = ALL_VIEW_IDS

// Lookup by composite `name` (the Central Panel storage key).
const PERMISSION_BY_NAME = new Map(PERMISSIONS.map((p) => [p.name, p]))
export function getPermissionById(id) {
  return PERMISSION_BY_NAME.get(id)
}

// Lookup by production-style numeric `id`.
const PERMISSION_BY_DB_ID = new Map(PERMISSIONS.map((p) => [p.id, p]))
export function getPermissionByDbId(dbId) {
  return PERMISSION_BY_DB_ID.get(dbId)
}

// Walk allow_parent_ids and return every name that should be auto-
// included when `name` is selected. Resolves parent references via
// production-style numeric ids, then returns their `name`s. Stops at
// cycles (visited set of dbIds).
export function getPermissionAncestorNames(name) {
  const out = new Set()
  const visited = new Set() // dbIds
  function walk(n) {
    if (!n || out.has(n)) return
    const p = PERMISSION_BY_NAME.get(n)
    if (!p) return
    out.add(n)
    if (!p.allow_parent_ids) return
    p.allow_parent_ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((parentDbId) => {
        if (visited.has(parentDbId)) return
        visited.add(parentDbId)
        const parent = PERMISSION_BY_DB_ID.get(Number(parentDbId))
        if (parent) walk(parent.name)
      })
  }
  walk(name)
  return Array.from(out)
}

// Map old Central Panel permission names → new composite names.
// Used by the v2 role migration (`migrateRolePermissionsV2` in
// centralApi.js) to translate role rows written by the previous
// coarse catalog (`server.view`, `member.manage`, etc.) into the new
// composite format (`organization.servers.view`,
// `organization.members.manage`, etc.).
//
// Anything not in this map is dropped during migration. The old
// catalog's `module.view` (only used in a code comment) is a no-op.
export const LEGACY_NAME_MAP = Object.freeze({
  'organization.view':   'organization.dashboard.view',
  'organization.manage': 'organization.dashboard.manage',
  'server.view':         'organization.servers.view',
  'server.manage':       'organization.servers.manage',
  'member.view':         'organization.members.view',
  'member.manage':       'organization.members.manage',
  'role.view':           'organization.roles_permissions.view',
  'role.manage':         'organization.roles_permissions.manage',
  'provider.view':       'organization.provider.view',
  'provider.manage':     'organization.provider.manage',
  'audit.view':          'organization.activity_log.view',
  // `audit.manage` has no direct equivalent — activity_log has only
  // view. Map to settings.manage as the closest "destructive
  // org-level action" gate; if the role only needs to read logs,
  // `audit.view` (→ activity_log.view) is sufficient.
  'audit.manage':        'organization.settings.manage',
})

// Translate a list of legacy names to the current composite format.
// Unknown legacy names are dropped (matches `sanitizePermissions`
// behavior). Names that are already in the new format pass through.
export function translateLegacyNames(names) {
  if (!Array.isArray(names)) return []
  const out = new Set()
  for (const n of names) {
    if (typeof n !== 'string') continue
    if (PERMISSION_BY_NAME.has(n)) { out.add(n); continue }
    const mapped = LEGACY_NAME_MAP[n]
    if (mapped) out.add(mapped)
  }
  return Array.from(out)
}

// Validate a permissions array (list of composite `name` strings).
//
// Steps:
//   1. Translate legacy coarse names to the new composite format
//      (silent — protects against roles written by previous builds).
//   2. Drop unknown names (silent — protects against typos).
//   3. De-duplicate.
//   4. Walk each name's allow_parent_ids chain and auto-include parents.
export function sanitizePermissions(names) {
  if (!Array.isArray(names)) return []
  const translated = translateLegacyNames(names)
  const out = new Set()
  for (const n of translated) {
    if (!PERMISSION_BY_NAME.has(n)) continue
    for (const ancestor of getPermissionAncestorNames(n)) {
      out.add(ancestor)
    }
  }
  return Array.from(out)
}