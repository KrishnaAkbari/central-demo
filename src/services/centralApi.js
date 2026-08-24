// Central Panel API — entirely mock for the demo. When the real backend
// is ready, flip MOCK_MODE to false and replace each function body with
// axios calls. The UI does not change.
//
// State storage:
//   - LocalStorage keys are namespaced "cp_*" to avoid collision with the
//     Open Source Panel's "srvrsmgmt_*" keys when both panels share the
//     same browser (demo flow).
//   - Auth: cp_auth = { userId, token: "cp_..." } | null
//   - Users: cp_users = [{ id, email, username, passwordHash, name, createdAt }]
//   - Organizations: cp_organizations = [{ id, name, description, createdById, createdAt }]
//   - Memberships (flat): cp_memberships = [{ organizationId, userId, roleId, joinedAt }]
//     roleId is a foreign key into cp_roles, OR null for the Org owner.
//   - Active Organization: cp_active_org = "<orgId>" | null
//   - Roles (per Org): cp_roles = [{ id, organizationId, name, title, description,
//     permissions: string[], isSystem: bool, createdAt, updatedAt }]
//   - Servers: cp_servers = [{ id, name, keyId, keyPreview, connectedAt, connectedById, orgId, source: 'management_key'|'provider'|'custom_vps', sourceDetail?, hostname, ip, region, provider, os, arch, webServer, phpVersion, nodeVersion }]
//   - Provider integrations: cp_providers = [{ id, orgId, provider: 'vultr'|'digitalocean'|'linode'|'hetzner', label, tokenPreview, connectedAt, connectedById }]
//   - Audit: cp_audit = [{ id, at, actorId, actorEmail, orgId, action, target, serverId, details }]
//   - Legacy alias: cp_teams is read once on first run after this build to
//     forward-migrate into cp_organizations + cp_memberships, then ignored.
//
// Password "hashing" for the demo: plain text, prefixed "mock:" so it is
// obviously NOT real hashing. Replace with bcrypt/argon2 when wired to
// a real backend.

import { ALL_PERMISSION_IDS, ALL_VIEW_IDS, COARSE_MANAGE_IDS, COARSE_VIEW_IDS, sanitizePermissions, translateLegacyNames } from '@/lib/permissions'
import { getPermissionById } from '@/lib/permissions'

const MOCK_MODE = true

export const KEYS = {
  AUTH: 'cp_auth',
  USERS: 'cp_users',
  ORGANIZATIONS: 'cp_organizations',
  MEMBERSHIPS: 'cp_memberships',
  ACTIVE_ORG: 'cp_active_org',
  SERVERS: 'cp_servers',
  AUDIT: 'cp_audit',
  ROLES: 'cp_roles',
  PROVIDERS: 'cp_providers',
  // Billing: per-Organization billing state (plan, trial, lifetime, etc.)
  // Shape: { [orgId]: BillingState }. See src/services/billingApi.js for
  // the canonical BillingState shape and lifecycle helpers.
  BILLING: 'cp_billing',
  // Wallet credit balance per Org. Shape: { [orgId]: { balance, currency } }.
  WALLET: 'cp_wallet',
  // Mock transaction history per Org. Shape: { [orgId]: Transaction[] }.
  TRANSACTIONS: 'cp_transactions',
  // Saved billing contact details per Org. Shape: { [orgId]: BillingDetails }.
  BILLING_DETAILS: 'cp_billing_details',
  // Auto-recharge rules per Org. Shape: { [orgId]: AutoRechargeSettings }.
  AUTO_RECHARGE: 'cp_auto_recharge',
  // Saved payment methods (cards on file) per Org. Shape:
  //   { [orgId]: { items: PaymentMethodCard[], defaultId: string | null, version: number } }.
  // See src/services/billingPaymentMethodsApi.js for the canonical
  // PaymentMethodCard shape and CRUD helpers.
  PAYMENT_METHODS: 'cp_payment_methods',
  // Globally-selected mock persona for testing all billing states. Single
  // value (not per-org) so testers can flip personas without re-seeding.
  BILLING_PERSONA: 'cp_billing_persona',
  // Per-(server, user) access grants. Each row says: "this user has
  // access to this server in this org with this role. Implies — not
  // represented as rows — that the Org Owner has access to every server
  // automatically. See listSharedUsersForServer / shareServerAccess /
  // unshareServerAccess below.
  SERVER_ACCESS: 'cp_server_access',
  // Legacy — read once for forward migration, then ignored.
  LEGACY_TEAMS: 'cp_teams',
}

// Per-Organization seeding sentinel. Stored as a JSON object
// `{ [organizationId]: 'done' }` in localStorage so each Org is
// seeded exactly once.
const ORG_ROLES_SEEDED_FLAG = 'cp_org_roles_seeded_v1'

// Single-pass migration sentinel. Set to 'done' after rewriting every
// cp_memberships row's hardcoded `role` string to a `roleId` pointer
// (or null for the Org owner).
const ROLE_MIGRATION_FLAG = 'cp_role_migration_v1'

const inBrowser = () => typeof window !== 'undefined'

export const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms))

export function read(key, fallback) {
  if (!inBrowser()) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function write(key, value) {
  if (!inBrowser()) return
  localStorage.setItem(key, JSON.stringify(value))
  // Mirror storage events for same-tab listeners (native 'storage' only
  // fires for cross-tab writes). Sidebar badges and live counters listen.
  if (
    key === KEYS.MEMBERSHIPS ||
    key === KEYS.ORGANIZATIONS ||
    key === KEYS.SERVERS ||
    key === KEYS.SERVER_ACCESS
  ) {
    window.dispatchEvent(new CustomEvent(`cp:${key.replace('cp_', '')}-changed`))
  }
}

// Plain-string setters/getters for single-value keys that should not be
// JSON-encoded (avoids the "stored value is JSON-wrapped string" footgun).
export function writeRaw(key, value) {
  if (!inBrowser()) return
  if (value === null || value === undefined) localStorage.removeItem(key)
  else localStorage.setItem(key, String(value))
}
export function readRaw(key) {
  if (!inBrowser()) return null
  const raw = localStorage.getItem(key)
  if (raw === null || raw === undefined) return null
  // Tolerate legacy JSON-encoded values from earlier drafts of this code.
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try { return JSON.parse(raw) } catch { return raw.slice(1, -1) }
  }
  return raw
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// --- ID + token helpers ------------------------------------------------------

function newUserId() { return uid('usr') }
function newOrgId() { return uid('org') }
function newServerId() { return uid('srv') }
function newAuditId() { return uid('aud') }
function newRoleId() { return uid('rol') }
function newServerAccessId() { return uid('sax') }
function newAuthToken() {
  // cp_<32 hex chars>
  const bytes = new Uint8Array(16)
  if (inBrowser() && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  let hex = ''
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
  return 'cp_' + hex
}

// --- Seed data (only on first ever load) -------------------------------------

const SEED_DEMO_KEY_PREFIX = 'sm_2426bfb34c'
const SEED_DEMO_KEY = 'sm_2426bfb34c7765907a613a2161b12140'

function seedIfEmpty() {
  if (read(KEYS.USERS, null) === null) {
    write(KEYS.USERS, []) // start empty — user must register first
  }
  if (read(KEYS.ORGANIZATIONS, null) === null) {
    write(KEYS.ORGANIZATIONS, [])
  }
  if (read(KEYS.MEMBERSHIPS, null) === null) {
    write(KEYS.MEMBERSHIPS, [])
  }
  if (read(KEYS.SERVERS, null) === null) {
    write(KEYS.SERVERS, [])
  }
  if (read(KEYS.AUDIT, null) === null) {
    write(KEYS.AUDIT, [])
  }
  if (read(KEYS.ROLES, null) === null) {
    write(KEYS.ROLES, [])
  }
  if (read(KEYS.BILLING, null) === null) {
    write(KEYS.BILLING, {})
  }
  if (read(KEYS.WALLET, null) === null) {
    write(KEYS.WALLET, {})
  }
  if (read(KEYS.PAYMENT_METHODS, null) === null) {
    write(KEYS.PAYMENT_METHODS, {})
  }
  if (read(KEYS.TRANSACTIONS, null) === null) {
    write(KEYS.TRANSACTIONS, {})
  }
  if (read(KEYS.BILLING_DETAILS, null) === null) {
    write(KEYS.BILLING_DETAILS, {})
  }
  if (read(KEYS.AUTO_RECHARGE, null) === null) {
    write(KEYS.AUTO_RECHARGE, {})
  }
  forwardMigrateLegacyTeams()
  // Backfill status/inviteeEmail on existing memberships so older rows
  // work with the new invite flow. Idempotent — re-running is a no-op.
  backfillMembershipInviteFields()
}

// One-time cleanup: every cp_roles.permissions array is rewritten in
// place so it only contains names from the current permission catalog
// (`sanitizePermissions` drops unknown ids and walks parent chains).
//
// Why this exists:
//   - Earlier demo builds had a granular `server.dashboard.view`,
//     `app.ssl.manage` etc. and stored those names on roles. The
//     current model is flat 6×2 (organization / server / member /
//     role / provider / audit × view / manage).
//   - Without this migration, role cards kept counting the orphaned
//     ids even though `getPermissionById` no longer resolves them.
//   - `sanitizePermissions` is also applied at every public read path
//     below, so roles surfaced through `listRolesForOrg`,
//     `getRoleById`, and `resolveMemberRole` always match the catalog.
//
// Idempotent. Writes back only when something actually changes.
function migrateRolePermissions() {
  if (readRaw('cp_role_perms_cleanup_v1') === 'done') {
    // Still normalize in-memory reads below — defensive only.
    return
  }
  const roles = read(KEYS.ROLES, [])
  if (!Array.isArray(roles) || roles.length === 0) {
    writeRaw('cp_role_perms_cleanup_v1', 'done')
    return
  }
  let touched = false
  for (const r of roles) {
    if (!r || !Array.isArray(r.permissions)) continue
    const cleaned = sanitizePermissions(r.permissions)
    const prev = r.permissions.length
    if (cleaned.length !== prev || cleaned.some((n, i) => n !== r.permissions[i])) {
      r.permissions = cleaned
      touched = true
    }
  }
  if (touched) write(KEYS.ROLES, roles)
  writeRaw('cp_role_perms_cleanup_v1', 'done')
}

// Defensive read-side cleanup used by every public role getter. Even
// after the migration above runs we still want `getPermissionById` to
// return a hit for every id on a role object — older rows from earlier
// demo builds may still surface a mix of valid + dead names, and this
// keeps the UI's permission count consistent with the catalog.
//
// Returns a shallow clone with `permissions` rewritten in place; the
// original object is left alone so callers can detect mutations if
// they ever need to.
function cleanRolePermissions(role) {
  if (!role) return role
  if (!Array.isArray(role.permissions)) return { ...role, permissions: [] }
  return { ...role, permissions: sanitizePermissions(role.permissions) }
}

// Forward-migration v2: rewrite every cp_roles.permissions array so
// legacy coarse names (`server.view`, `member.manage`, `role.manage`,
// etc.) become the new composite `${level}.${name}.${action}` keys
// (`organization.servers.view`, `organization.members.manage`,
// `organization.roles_permissions.manage`, etc.).
//
// Why a separate migration:
//   - `migrateRolePermissions` (v1) already runs `sanitizePermissions`
//     and would technically catch this on the first pass after the
//     catalog swap, but only if its `cp_role_perms_cleanup_v1` flag is
//     not yet set. Users who came from a previous build would already
//     have v1='done' from the old catalog, so storage would still hold
//     coarse names until they manually cleared it.
//   - v2 is idempotent and explicitly translates every legacy name via
//     `translateLegacyNames`. After it runs, storage is canonical
//     (composite keys only) and any future read path can rely on the
//     catalog directly without translation.
//
// Idempotent. Writes back only when something actually changes.
function migrateRolePermissionsV2() {
  if (readRaw('cp_role_perms_cleanup_v2') === 'done') return
  const roles = read(KEYS.ROLES, [])
  if (!Array.isArray(roles) || roles.length === 0) {
    writeRaw('cp_role_perms_cleanup_v2', 'done')
    return
  }
  let touched = false
  for (const r of roles) {
    if (!r || !Array.isArray(r.permissions)) continue
    const translated = sanitizePermissions(r.permissions)
    const prev = r.permissions
    if (translated.length !== prev.length || translated.some((n, i) => n !== prev[i])) {
      r.permissions = translated
      touched = true
    }
  }
  if (touched) write(KEYS.ROLES, roles)
  writeRaw('cp_role_perms_cleanup_v2', 'done')
}

// One-time backfill: every existing cp_memberships row is implicitly
// 'active' (userId is set). Any future row with userId === null and a
// non-empty inviteeEmail is interpreted as an invitation. We add the
// status field to old rows so hydrateMembers + the Members page can
// branch on it without worrying about undefined. Idempotent.
function backfillMembershipInviteFields() {
  if (readRaw('cp_membership_invite_v1') === 'done') return
  const memberships = read(KEYS.MEMBERSHIPS, [])
  if (!Array.isArray(memberships) || memberships.length === 0) {
    writeRaw('cp_membership_invite_v1', 'done')
    return
  }
  let touched = false
  memberships.forEach((m) => {
    if (!m) return
    if (m.status === undefined) { m.status = 'active'; touched = true }
    if (m.inviteeEmail === undefined) { m.inviteeEmail = ''; touched = true }
  })
  if (touched) write(KEYS.MEMBERSHIPS, memberships)
  writeRaw('cp_membership_invite_v1', 'done')
}

// One-time forward-migration of cp_server_access from the legacy
// role-based shape to the permission-list shape used by server
// sharing.
//
//   Old: { id, orgId, serverId, userId, roleId, grantedById, grantedAt }
//   New: { id, orgId, serverId, userId, permissions[], grantedById, grantedAt }
//
// Each row's `roleId` is expanded into `role.permissions`, then the
// per-row permission list is sanitized (de-duped, walked through
// allow_parent_ids so each access row grants the full effective
// grant). Unknown roleIds produce an empty permissions array so the
// row is preserved (audit trail) but grants nothing until the Owner
// edits it.
//
// Idempotent. Drops `roleId` only after the migration flag is set.
function migrateServerAccessToPermissions() {
  if (readRaw('cp_server_access_perms_v1') === 'done') return
  const rows = read(KEYS.SERVER_ACCESS, [])
  if (!Array.isArray(rows) || rows.length === 0) {
    writeRaw('cp_server_access_perms_v1', 'done')
    return
  }
  const roles = read(KEYS.ROLES, [])
  let touched = false
  for (const r of rows) {
    if (!r) continue
    // Already migrated? Just drop the legacy roleId if still present.
    if (Array.isArray(r.permissions)) {
      if (r.roleId !== undefined) {
        delete r.roleId
        touched = true
      }
      continue
    }
    const role = roles.find((rl) => rl.id === r.roleId && rl.organizationId === r.organizationId)
    const perms = role && Array.isArray(role.permissions) ? sanitizePermissions(role.permissions) : []
    r.permissions = perms
    delete r.roleId
    touched = true
  }
  if (touched) write(KEYS.SERVER_ACCESS, rows)
  writeRaw('cp_server_access_perms_v1', 'done')
}

// One-time forward-migration from the previous cp_teams storage into
// cp_organizations + cp_memberships. Idempotent: a sentinel flag prevents
// re-running after the first pass. The cp_teams key is left untouched so
// old audit entries that referenced teamIds still resolve to readable
// names where needed.
const MIGRATION_FLAG = 'cp_org_migration_v1'
function forwardMigrateLegacyTeams() {
  if (read(MIGRATION_FLAG, null) === 'done') return
  const legacy = read(KEYS.LEGACY_TEAMS, null)
  const orgs = read(KEYS.ORGANIZATIONS, [])
  const memberships = read(KEYS.MEMBERSHIPS, [])
  if (Array.isArray(legacy) && legacy.length > 0) {
    legacy.forEach((t) => {
      if (!t || !t.id) return
      // Skip if already migrated by id (defensive)
      if (orgs.some((o) => o.id === t.id)) return
      orgs.push({
        id: t.id,
        name: t.name,
        description: '',
        createdById: t.ownerId,
        createdAt: t.createdAt,
      })
      if (Array.isArray(t.members)) {
        t.members.forEach((m) => {
          if (!m || !m.userId) return
          if (memberships.some((x) => x.organizationId === t.id && x.userId === m.userId)) return
          memberships.push({
            organizationId: t.id,
            userId: m.userId,
            role: m.role || 'member',
            joinedAt: t.createdAt,
          })
        })
      }
    })
    write(KEYS.ORGANIZATIONS, orgs)
    write(KEYS.MEMBERSHIPS, memberships)
  }
  write(MIGRATION_FLAG, 'done')
}

// Backfill orgId onto existing cp_servers and cp_audit entries that were
// created before Organization scoping was introduced. The user's first
// Organization is used. If the user has zero Organizations (shouldn't
// happen post-migration, but defensive), these rows are simply skipped —
// they will become visible once the user creates their first Org and the
// pages will re-include them. Idempotent.
function backfillOrgIds() {
  if (read('cp_org_backfill_v1', null) === 'done') return
  const orgs = read(KEYS.ORGANIZATIONS, [])
  if (!Array.isArray(orgs) || orgs.length === 0) {
    write('cp_org_backfill_v1', 'done')
    return
  }
  const fallbackOrgId = orgs[0].id
  const servers = read(KEYS.SERVERS, [])
  let touched = false
  if (Array.isArray(servers)) {
    servers.forEach((s) => {
      if (!s.orgId) {
        s.orgId = fallbackOrgId
        touched = true
      }
    })
    if (touched) write(KEYS.SERVERS, servers)
  }
  const audit = read(KEYS.AUDIT, [])
  let touchedAudit = false
  if (Array.isArray(audit)) {
    audit.forEach((e) => {
      if (!e.orgId) {
        e.orgId = fallbackOrgId
        touchedAudit = true
      }
    })
    if (touchedAudit) write(KEYS.AUDIT, audit)
  }
  write('cp_org_backfill_v1', 'done')
}

// Read / mutate the per-Org seeding sentinel as an object map.
function readSeededMap() {
  const raw = readRaw(ORG_ROLES_SEEDED_FLAG)
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}
function writeSeededMap(map) {
  writeRaw(ORG_ROLES_SEEDED_FLAG, JSON.stringify(map || {}))
}

// Create the Admin + Member roles for an Organization if not already
// seeded. Idempotent: each Org is recorded in the per-Org sentinel
// after its first seed, so re-runs skip it.
//
// Must be called BEFORE inserting any cp_memberships row that wants to
// reference the Admin or Member role by id.
function seedDefaultRolesForOrg(orgId) {
  const seeded = readSeededMap()
  if (seeded[orgId] === 'done') return
  const roles = read(KEYS.ROLES, [])
  // Defensive double-check: the per-Org sentinel and the actual roles
  // array should agree. If a previous build partially seeded (e.g. an
  // interrupted write), skip rather than duplicate.
  if (roles.some((r) => r.organizationId === orgId && r.isSystem && (r.name === 'admin' || r.name === 'member'))) {
    seeded[orgId] = 'done'
    writeSeededMap(seeded)
    return
  }
  const now = new Date().toISOString()
  const adminRole = {
    id: newRoleId(),
    organizationId: orgId,
    name: 'admin',
    title: 'Admin',
    description: 'Full organization access',
    // Coarse ids only — Admin has all module manages. sanitizePermissions
    // will also pull in their `.view` companions via allow_parent_ids.
    permissions: COARSE_MANAGE_IDS,
    isSystem: true,
    createdAt: now,
    updatedAt: now,
  }
  const memberRole = {
    id: newRoleId(),
    organizationId: orgId,
    name: 'member',
    title: 'Member',
    description: 'Read-only access to organization resources',
    permissions: COARSE_VIEW_IDS,
    isSystem: true,
    createdAt: now,
    updatedAt: now,
  }
  roles.push(adminRole, memberRole)
  write(KEYS.ROLES, roles)
  seeded[orgId] = 'done'
  writeSeededMap(seeded)
}

// Single-pass migration from hardcoded `role` strings on cp_memberships
// to `roleId` pointers. Run after `backfillOrgIds()` and after every
// existing Org has had its default roles seeded. Idempotent.
//
//   role === 'owner'  → roleId === null  (the Org owner marker)
//   role === 'admin'  → roleId === <Admin role id for this Org>
//   anything else     → roleId === <Member role id for this Org>
function migrateMembershipsToRoleId() {
  if (readRaw(ROLE_MIGRATION_FLAG) === 'done') return
  const memberships = read(KEYS.MEMBERSHIPS, [])
  if (!Array.isArray(memberships)) {
    writeRaw(ROLE_MIGRATION_FLAG, 'done')
    return
  }
  // Make sure every Org touched by a membership has default roles.
  const orgsTouched = new Set(memberships.map((m) => m.organizationId).filter(Boolean))
  orgsTouched.forEach((orgId) => seedDefaultRolesForOrg(orgId))
  const roles = read(KEYS.ROLES, [])
  let touched = false
  memberships.forEach((m) => {
    if (m.roleId !== undefined && m.roleId !== null) return // already migrated
    if (m.roleId === undefined && m.role === undefined) return // nothing to migrate
    const adminRole = roles.find((r) => r.organizationId === m.organizationId && r.name === 'admin')
    const memberRole = roles.find((r) => r.organizationId === m.organizationId && r.name === 'member')
    if (m.role === 'owner') {
      m.roleId = null
    } else if (m.role === 'admin' && adminRole) {
      m.roleId = adminRole.id
    } else if (memberRole) {
      m.roleId = memberRole.id
    } else {
      // Couldn't resolve a role. Leave roleId undefined so the row is
      // visibly broken rather than silently miscategorised.
      m.roleId = null
    }
    delete m.role
    touched = true
  })
  if (touched) write(KEYS.MEMBERSHIPS, memberships)
  writeRaw(ROLE_MIGRATION_FLAG, 'done')
}

// --- Auth --------------------------------------------------------------------

export async function register({ email, username, password, name }) {
  if (!MOCK_MODE) throw new Error('real backend not wired')
  await delay(350)

  const cleanEmail = (email || '').trim().toLowerCase()
  const cleanUsername = (username || '').trim()
  const cleanName = (name || '').trim() || cleanUsername

  if (!cleanEmail || !cleanUsername || !password) {
    throw new Error('Email, username and password are required')
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    throw new Error('Invalid email address')
  }
  if (!/^[a-zA-Z0-9_-]{2,32}$/.test(cleanUsername)) {
    throw new Error('Username must be 2–32 characters, letters, numbers, underscore or hyphen')
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }

  const users = read(KEYS.USERS, [])
  if (users.some((u) => u.email === cleanEmail)) {
    throw new Error('An account with this email already exists')
  }
  if (users.some((u) => u.username === cleanUsername)) {
    throw new Error('Username is already taken')
  }

  const user = {
    id: newUserId(),
    email: cleanEmail,
    username: cleanUsername,
    name: cleanName,
    passwordHash: 'mock:' + password,
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  write(KEYS.USERS, users)

  // Create default Organization for this user, then set active, then
  // audit. Correct init order ensures the register audit entry is
  // scoped to the new Organization. The default name is "Personal" so
  // every new account has an Org immediately — pages never redirect
  // the user to /organizations right after register.
  const now = new Date().toISOString()
  const org = {
    id: newOrgId(),
    name: 'Personal',
    description: '',
    createdById: user.id,
    createdAt: now,
  }
  const orgs = read(KEYS.ORGANIZATIONS, [])
  orgs.push(org)
  write(KEYS.ORGANIZATIONS, orgs)

  // Seed Admin + Member roles for this Org BEFORE inserting the owner
  // membership, so the row's `roleId` is resolvable even though the
  // owner uses roleId: null (defensive — future code may consult the
  // role to render an Owner badge with the role's color scheme).
  seedDefaultRolesForOrg(org.id)

  const memberships = read(KEYS.MEMBERSHIPS, [])
  memberships.push({
    organizationId: org.id,
    userId: user.id,
    inviteeEmail: user.email,
    roleId: null, // null marks the Org owner — not removable, not reassignable
    status: 'active',
    joinedAt: now,
    invitedAt: null,
  })
  // Activate any pending invitations addressed to this email — a new
  // user lands already pre-joined to any Orgs that invited them before
  // they existed. We also write per-Org audit entries so the inviting
  // Org sees that the invite was accepted.
  const activatedOrgs = activatePendingInvitesForNewUser(user, memberships)
  // Always write the memberships array: the owner row was pushed above
  // and needs to land in localStorage, plus any activated invites were
  // mutated in place by activatePendingInvitesForNewUser. Without the
  // unconditional write, fresh registrations end up with empty
  // cp_memberships and the (authenticated) layout's "no orgs" guard
  // immediately bounces them to /organizations.
  write(KEYS.MEMBERSHIPS, memberships)

  writeRaw(KEYS.ACTIVE_ORG, org.id)

  const token = newAuthToken()
  write(KEYS.AUTH, { userId: user.id, token, createdAt: now })

  appendAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'register',
    target: 'self',
    details: `Account created for ${user.email}`,
  })

  appendInviteAcceptanceAudit(user, activatedOrgs)

  return { user: publicUser(user), token }
}

export async function login({ email, password }) {
  if (!MOCK_MODE) throw new Error('real backend not wired')
  await delay(300)

  const cleanEmail = (email || '').trim().toLowerCase()
  const users = read(KEYS.USERS, [])
  const user = users.find((u) => u.email === cleanEmail)
  if (!user || user.passwordHash !== 'mock:' + password) {
    throw new Error('Invalid email or password')
  }

  const token = newAuthToken()
  write(KEYS.AUTH, { userId: user.id, token, createdAt: new Date().toISOString() })

  appendAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'login',
    target: 'self',
    details: 'Signed in',
  })

  return { user: publicUser(user), token }
}

export async function logout() {
  const auth = read(KEYS.AUTH, null)
  if (auth) {
    const users = read(KEYS.USERS, [])
    const user = users.find((u) => u.id === auth.userId)
    appendAudit({
      actorId: auth.userId,
      actorEmail: user?.email || 'unknown',
      action: 'logout',
      target: 'self',
      details: 'Signed out',
    })
  }
  write(KEYS.AUTH, null)
}

export async function getCurrentSession() {
  const auth = read(KEYS.AUTH, null)
  if (!auth) return null
  const users = read(KEYS.USERS, [])
  const user = users.find((u) => u.id === auth.userId)
  if (!user) return null
  return { user: publicUser(user), token: auth.token }
}

// --- Roles + Permissions (Task 2) ----------------------------------------

// Read a role by id. Returns null if not found. The returned object
// has its `permissions` array filtered through `cleanRolePermissions`
// so the catalog and the role stay in sync — without this, roles
// authored under an earlier (granular) permission model kept counting
// orphaned ids in the UI.
export function getRoleById(roleId) {
  if (!roleId) return null
  const roles = read(KEYS.ROLES, [])
  const found = roles.find((r) => r.id === roleId)
  return found ? cleanRolePermissions(found) : null
}

// Resolve the role row assigned to a user inside an Org. Returns the
// role object, or null when the user is the Org owner (roleId === null),
// when no membership exists, or when the role has been deleted. The
// returned role's `permissions` are filtered through
// `cleanRolePermissions` for consistency with `getRoleById` and the
// public `listRolesForOrg` getter.
export function resolveMemberRole(userId, orgId) {
  if (!userId || !orgId) return null
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const row = memberships.find((m) => m.organizationId === orgId && m.userId === userId)
  if (!row) return null
  if (row.roleId === null) return null // owner marker — not a regular role
  return getRoleById(row.roleId)
}

// True when the user has a membership row in this org with roleId === null.
// The owner marker. Used by the React-side `useIsOwner` hook and by
// `assertCanManageServerAccess` (which is owner-only by design, not
// permission-gated).
export function isOrganizationOwner(userId, orgId) {
  if (!userId || !orgId) return false
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const row = memberships.find((m) => m.organizationId === orgId && m.userId === userId)
  return !!row && row.roleId === null
}

// Permission check. Synchronous — safe to call from React hooks and
// from the service layer. Returns false when:
//   - inputs are missing
//   - no membership row exists for userId+orgId
//   - the role was deleted after the membership was assigned
// Returns true when:
//   - the user is the Org owner (roleId === null)
//   - the membership's role includes `permissionId` in its permissions list
export function can(userId, orgId, permissionId) {
  if (!userId || !orgId || !permissionId) return false
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const row = memberships.find((m) => m.organizationId === orgId && m.userId === userId)
  if (!row) return false
  if (row.roleId === null || row.roleId === undefined) return true // owner
  const role = getRoleById(row.roleId)
  if (!role) return false
  return Array.isArray(role.permissions) && role.permissions.includes(permissionId)
}

// Throws when the user lacks the permission inside the given Org. Use
// this inside service-layer mutations to refuse calls regardless of UI
// state. Returns nothing on success.
export function assertCan(userId, orgId, permissionId) {
  if (!can(userId, orgId, permissionId)) {
    const err = new Error(`You don't have permission: ${permissionId}`)
    err.code = 'FORBIDDEN'
    throw err
  }
}

// List all roles in the active Organization. Sorted: system roles first
// (Admin before Member), then custom roles alphabetical by title. Each
// returned role is filtered through `cleanRolePermissions` so legacy
// ids from older builds never inflate the displayed permission count.
export async function listRolesForOrg(orgId = null) {
  const targetOrgId = orgId ?? readRaw(KEYS.ACTIVE_ORG)
  if (!targetOrgId) return []
  await delay(40)
  const roles = read(KEYS.ROLES, [])
  const filtered = roles
    .filter((r) => r.organizationId === targetOrgId)
    .map(cleanRolePermissions)
  const systemOrder = { admin: 0, member: 1 }
  filtered.sort((a, b) => {
    if (a.isSystem && !b.isSystem) return -1
    if (!a.isSystem && b.isSystem) return 1
    if (a.isSystem && b.isSystem) {
      return (systemOrder[a.name] ?? 99) - (systemOrder[b.name] ?? 99)
    }
    return (a.title || a.name).localeCompare(b.title || b.name)
  })
  return filtered
}

// Create a custom role in the active Organization. System roles
// (Admin / Member) cannot be created via this path — they are auto-
// seeded. Caller passes the result of `useCan('organization.roles_permissions.manage')` to gate
// the UI; service layer also runs `assertCan` defensively.
export async function createRole({ name, title, description, permissions }) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) throw new Error('No active organization')
  assertCan(auth.userId, orgId, 'organization.roles_permissions.manage')
  await delay(120)
  const cleanName = (name || '').trim().toLowerCase()
  const cleanTitle = (title || '').trim()
  const cleanDesc = (description || '').trim()
  if (!/^[a-z][a-z0-9_-]*$/.test(cleanName) || cleanName.length < 2 || cleanName.length > 50) {
    throw new Error('Name must be 2-50 chars, lowercase letters, digits, underscores, hyphens (start with a letter)')
  }
  if (cleanTitle.length < 2 || cleanTitle.length > 100) {
    throw new Error('Title must be 2-100 characters')
  }
  if (cleanDesc.length > 500) {
    throw new Error('Description must be at most 500 characters')
  }
  const safePerms = sanitizePermissions(permissions)
  const roles = read(KEYS.ROLES, [])
  if (roles.some((r) => r.organizationId === orgId && r.name === cleanName)) {
    throw new Error('A role with this name already exists in this organization')
  }
  const now = new Date().toISOString()
  const role = {
    id: newRoleId(),
    organizationId: orgId,
    name: cleanName,
    title: cleanTitle,
    description: cleanDesc,
    permissions: safePerms,
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  }
  roles.push(role)
  write(KEYS.ROLES, roles)
  const users = read(KEYS.USERS, [])
  const actor = users.find((u) => u.id === auth.userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: actor?.email || 'unknown',
    action: 'create_role',
    target: role.id,
    details: `Created role ${role.title}`,
  })
  return role
}

// Update a custom role's title / description / permissions. System roles
// cannot have their permissions changed (only title/description).
export async function updateRole(roleId, { title, description, permissions }) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) throw new Error('No active organization')
  assertCan(auth.userId, orgId, 'organization.roles_permissions.manage')
  await delay(120)
  const roles = read(KEYS.ROLES, [])
  const idx = roles.findIndex((r) => r.id === roleId && r.organizationId === orgId)
  if (idx === -1) throw new Error('Role not found')
  const role = roles[idx]
  if (typeof title === 'string') {
    const cleanTitle = title.trim()
    if (cleanTitle.length < 2 || cleanTitle.length > 100) {
      throw new Error('Title must be 2-100 characters')
    }
    role.title = cleanTitle
  }
  if (typeof description === 'string') {
    const cleanDesc = description.trim()
    if (cleanDesc.length > 500) {
      throw new Error('Description must be at most 500 characters')
    }
    role.description = cleanDesc
  }
  if (permissions !== undefined && !role.isSystem) {
    role.permissions = sanitizePermissions(permissions)
  }
  role.updatedAt = new Date().toISOString()
  roles[idx] = role
  write(KEYS.ROLES, roles)
  const users = read(KEYS.USERS, [])
  const actor = users.find((u) => u.id === auth.userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: actor?.email || 'unknown',
    action: 'update_role',
    target: role.id,
    details: `Updated role ${role.title}`,
  })
  return role
}

// Delete a custom role. System roles cannot be deleted. If any membership
// row still references the role, refuse with a clear error (caller must
// reassign or remove those members first).
export async function deleteRole(roleId) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) throw new Error('No active organization')
  assertCan(auth.userId, orgId, 'organization.roles_permissions.manage')
  await delay(150)
  const roles = read(KEYS.ROLES, [])
  const role = roles.find((r) => r.id === roleId && r.organizationId === orgId)
  if (!role) throw new Error('Role not found')
  if (role.isSystem) throw new Error('Built-in roles cannot be deleted')
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const referenced = memberships.some((m) => m.organizationId === orgId && m.roleId === roleId)
  if (referenced) {
    throw new Error('This role is still assigned to one or more members. Reassign or remove them first.')
  }
  const next = roles.filter((r) => r.id !== roleId)
  write(KEYS.ROLES, next)
  // Cascade: drop every per-server access row that pointed at this
  // role. Deleting the role makes those grants orphan.
  const accessRows = readServerAccessRows()
  const accessNext = accessRows.filter((r) => !(r.organizationId === orgId && r.roleId === roleId))
  if (accessNext.length !== accessRows.length) write(KEYS.SERVER_ACCESS, accessNext)
  const users = read(KEYS.USERS, [])
  const actor = users.find((u) => u.id === auth.userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: actor?.email || 'unknown',
    action: 'delete_role',
    target: roleId,
    details: `Deleted role ${role.title}`,
  })
}

// Add a member to the active Organization by email. If the user has
// already registered a Central Panel account, they join immediately.
// If they have not, we create an invitation (status: 'invited') that
// auto-activates when the invitee registers. Either way, the caller
// gets back a result describing what happened so the UI can toast
// accordingly.
export async function addOrgMember(orgId, email, roleId) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  const targetOrgId = orgId ?? readRaw(KEYS.ACTIVE_ORG)
  if (!targetOrgId) throw new Error('No active organization')
  assertCan(auth.userId, targetOrgId, 'organization.members.manage')
  await delay(200)
  const cleanEmail = (email || '').trim().toLowerCase()
  if (!cleanEmail) throw new Error('Email is required')
  const users = read(KEYS.USERS, [])
  const target = users.find((u) => u.email === cleanEmail)
  const roles = read(KEYS.ROLES, [])
  const role = roles.find((r) => r.id === roleId && r.organizationId === targetOrgId)
  if (!role) throw new Error('Role not found in this organization')
  const memberships = read(KEYS.MEMBERSHIPS, [])

  // Dedup: refuse if there is already an active member with this email,
  // OR a pending invitation for the same email (so you don't spam
  // multiple invites to one address).
  if (target) {
    if (memberships.some((m) => m.organizationId === targetOrgId && m.userId === target.id)) {
      throw new Error('User is already a member of this organization')
    }
  } else {
    if (memberships.some((m) => m.organizationId === targetOrgId && m.inviteeEmail === cleanEmail && m.status === 'invited')) {
      throw new Error('That email already has a pending invitation')
    }
  }

  const now = new Date().toISOString()
  let resultRow
  if (target) {
    memberships.push({
      organizationId: targetOrgId,
      userId: target.id,
      inviteeEmail: target.email, // mirror for hydration symmetry
      roleId: role.id,
      status: 'active',
      joinedAt: now,
      invitedAt: null,
    })
    resultRow = { status: 'active', email: target.email, roleTitle: role.title, user: publicUser(target) }
  } else {
    memberships.push({
      organizationId: targetOrgId,
      userId: null,
      inviteeEmail: cleanEmail,
      roleId: role.id,
      status: 'invited',
      joinedAt: null,
      invitedAt: now,
    })
    resultRow = { status: 'invited', email: cleanEmail, roleTitle: role.title, user: null }
  }
  write(KEYS.MEMBERSHIPS, memberships)
  const actor = users.find((u) => u.id === auth.userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: actor?.email || 'unknown',
    action: target ? 'add_member' : 'invite_member',
    target: targetOrgId,
    details: target
      ? `Added ${target.email} as ${role.title} to organization`
      : `Invited ${cleanEmail} as ${role.title} (pending registration)`,
  })
  return resultRow
}

// Change a non-owner member's role. Owner rows (roleId === null) cannot
// be reassigned — the owner is the creator of the Org and stays.
//
// `key` is { userId } for active members OR { inviteeEmail } for
// pending invitations. Exactly one is required.
export async function changeOrgMemberRole(orgId, key, newRoleId) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  const targetOrgId = orgId ?? readRaw(KEYS.ACTIVE_ORG)
  if (!targetOrgId) throw new Error('No active organization')
  assertCan(auth.userId, targetOrgId, 'organization.members.manage')
  await delay(180)
  if (!key || (key.userId == null && !key.inviteeEmail)) throw new Error('Member key required')
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const idx = memberships.findIndex((m) => {
    if (m.organizationId !== targetOrgId) return false
    if (key.userId != null) return m.userId === key.userId
    return m.inviteeEmail === key.inviteeEmail && m.status === 'invited'
  })
  if (idx === -1) throw new Error('Member not found')
  const row = memberships[idx]
  if (row.roleId === null) throw new Error('Cannot change the organization owner role')
  const roles = read(KEYS.ROLES, [])
  const role = roles.find((r) => r.id === newRoleId && r.organizationId === targetOrgId)
  if (!role) throw new Error('Role not found in this organization')
  row.roleId = role.id
  write(KEYS.MEMBERSHIPS, memberships)
  const users = read(KEYS.USERS, [])
  const actor = users.find((u) => u.id === auth.userId)
  const label = key.userId
    ? (users.find((u) => u.id === key.userId)?.email || key.userId)
    : key.inviteeEmail
  appendAudit({
    actorId: auth.userId,
    actorEmail: actor?.email || 'unknown',
    action: 'change_member_role',
    target: targetOrgId,
    details: `Changed role of ${label} to ${role.title}`,
  })
  return role
}

// Re-stamp a pending invitation. No backend "send" happens — the demo
// just refreshes `invitedAt` so the row's "invited 5m ago" copy updates
// and an audit row records the resend. Used by the Members page's
// per-row "Resend invite" action when an invite has been sitting
// pending long enough to be re-sent.
export async function resendOrgInvitation(orgId, inviteeEmail) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  const targetOrgId = orgId ?? readRaw(KEYS.ACTIVE_ORG)
  if (!targetOrgId) throw new Error('No active organization')
  assertCan(auth.userId, targetOrgId, 'organization.members.manage')
  await delay(120)
  const cleanEmail = (inviteeEmail || '').trim().toLowerCase()
  if (!cleanEmail) throw new Error('Invitation key required')
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const row = memberships.find((m) =>
    m.organizationId === targetOrgId &&
    m.inviteeEmail === cleanEmail &&
    m.status === 'invited'
  )
  if (!row) throw new Error('Invitation not found or already accepted')
  row.invitedAt = new Date().toISOString()
  write(KEYS.MEMBERSHIPS, memberships)
  const users = read(KEYS.USERS, [])
  const actor = users.find((u) => u.id === auth.userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: actor?.email || 'unknown',
    action: 'resend_invitation',
    target: targetOrgId,
    details: `Resent invitation to ${cleanEmail}`,
  })
  return true
}

// Cancel a pending invitation (key = inviteeEmail) before the invitee
// has registered. Removes the membership row entirely so the invite
// disappears from the list and audit logs the cancellation.
export async function cancelOrgInvitation(orgId, inviteeEmail) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  const targetOrgId = orgId ?? readRaw(KEYS.ACTIVE_ORG)
  if (!targetOrgId) throw new Error('No active organization')
  assertCan(auth.userId, targetOrgId, 'organization.members.manage')
  await delay(120)
  const cleanEmail = (inviteeEmail || '').trim().toLowerCase()
  if (!cleanEmail) throw new Error('Invitation key required')
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const row = memberships.find((m) =>
    m.organizationId === targetOrgId &&
    m.inviteeEmail === cleanEmail &&
    m.status === 'invited'
  )
  if (!row) throw new Error('Invitation not found')
  const next = memberships.filter((m) => !(m.organizationId === targetOrgId && m.inviteeEmail === cleanEmail && m.status === 'invited'))
  write(KEYS.MEMBERSHIPS, next)
  const users = read(KEYS.USERS, [])
  const actor = users.find((u) => u.id === auth.userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: actor?.email || 'unknown',
    action: 'cancel_invitation',
    target: targetOrgId,
    details: `Cancelled invitation to ${cleanEmail}`,
  })
  return true
}

// Remove a non-owner member from the active Organization. The Org owner
// (roleId === null) cannot be removed.
export async function removeOrgMember(orgId, userId) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  if (userId === auth.userId) throw new Error('You cannot remove yourself')
  const targetOrgId = orgId ?? readRaw(KEYS.ACTIVE_ORG)
  if (!targetOrgId) throw new Error('No active organization')
  assertCan(auth.userId, targetOrgId, 'organization.members.manage')
  await delay(180)
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const row = memberships.find((m) => m.organizationId === targetOrgId && m.userId === userId)
  if (!row) throw new Error('Member not found')
  if (row.roleId === null) throw new Error('Cannot remove the organization owner')
  const next = memberships.filter((m) => !(m.organizationId === targetOrgId && m.userId === userId))
  write(KEYS.MEMBERSHIPS, next)
  // Cascade: drop this user's per-server access rows in the same Org.
  // Removing them from the Org revokes their server access by definition.
  const accessRows = readServerAccessRows()
  const accessNext = accessRows.filter((r) => !(r.organizationId === targetOrgId && r.userId === userId))
  if (accessNext.length !== accessRows.length) write(KEYS.SERVER_ACCESS, accessNext)
  const users = read(KEYS.USERS, [])
  const actor = users.find((u) => u.id === auth.userId)
  const target = users.find((u) => u.id === userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: actor?.email || 'unknown',
    action: 'remove_member',
    target: targetOrgId,
    details: `Removed ${target?.email || userId} from organization`,
  })
}

// Hydrate a list of memberships into the shape used by the Members
// page. Two row shapes:
//   active  → { kind:'active',  user, role, isOwner, joinedAt }
//   invite  → { kind:'invited', inviteeEmail, namePlaceholder, role, invitedAt }
// Active rows come first; invite rows are sorted AFTER, and grouped
// separately by the page. Owner rows (roleId === null) are flagged
// isOwner=true and skip the role lookup.
function hydrateMembers(orgId) {
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const users = read(KEYS.USERS, [])
  const roles = read(KEYS.ROLES, [])
  const rows = memberships.filter((m) => m.organizationId === orgId)
  const out = []
  for (const m of rows) {
    const status = m.status || 'active'
    if (status === 'invited') {
      const role = roles.find((r) => r.id === m.roleId) || null
      out.push({
        kind: 'invited',
        inviteeEmail: m.inviteeEmail || '',
        namePlaceholder: emailToInitials(m.inviteeEmail || '?'),
        role,
        invitedAt: m.invitedAt || m.joinedAt || new Date().toISOString(),
        roleId: m.roleId,
      })
      continue
    }
    const user = users.find((u) => u.id === m.userId)
    if (!user) continue
    if (m.roleId === null) {
      out.push({ kind: 'active', user: publicUser(user), role: null, isOwner: true, joinedAt: m.joinedAt, roleId: null })
      continue
    }
    const role = roles.find((r) => r.id === m.roleId) || null
    out.push({ kind: 'active', user: publicUser(user), role, isOwner: false, joinedAt: m.joinedAt, roleId: m.roleId })
  }
  // Owners first, then active members sorted by email, then invites.
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'active' ? -1 : 1
    if (a.kind === 'active' && b.kind === 'active') {
      if (a.isOwner && !b.isOwner) return -1
      if (!a.isOwner && b.isOwner) return 1
      return (a.user.email || '').localeCompare(b.user.email || '')
    }
    return (a.inviteeEmail || '').localeCompare(b.inviteeEmail || '')
  })
  return out
}

// Walk the in-memory membership list and flip any rows that match the
// new user's email from 'invited' to 'active'. Returns the list of Org
// ids where activations happened so the caller can write per-Org audit
// entries once auth + active org are set.
function activatePendingInvitesForNewUser(user, memberships) {
  const activated = []
  if (!user || !user.email) return activated
  for (const m of memberships) {
    if (!m || m.status !== 'invited') continue
    if (m.inviteeEmail !== user.email) continue
    m.userId = user.id
    m.status = 'active'
    m.joinedAt = new Date().toISOString()
    activated.push({ organizationId: m.organizationId, roleTitle: m.roleId })
  }
  return activated
}

// Write one audit entry per Org that had a pending invite for the just-
// registered user. Called after auth/active-org are settled.
function appendInviteAcceptanceAudit(user, activated) {
  if (!activated || activated.length === 0) return
  const orgs = read(KEYS.ORGANIZATIONS, [])
  for (const { organizationId } of activated) {
    const org = orgs.find((o) => o.id === organizationId)
    appendAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'invite_accepted',
      target: organizationId,
      details: `Joined ${org ? org.name : 'organization'} via invitation`,
    })
  }
}

// 2-letter avatar initials for an invitee with no real name yet.
function emailToInitials(email) {
  if (!email) return '?'
  const handle = email.split('@')[0] || email
  const trimmed = handle.replace(/[^a-z0-9]/gi, '')
  if (!trimmed) return '?'
  if (trimmed.length === 1) return trimmed[0].toUpperCase()
  return (trimmed[0] + trimmed[1]).toUpperCase()
}

// --- Organizations (Task 1) -----------------------------------------------

// Returns every Organization the current user is a member of.
export async function listOrganizationsForUser() {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(60)
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const orgs = read(KEYS.ORGANIZATIONS, [])
  const userOrgIds = memberships.filter((m) => m.userId === auth.userId).map((m) => m.organizationId)
  const set = new Set(userOrgIds)
  return orgs.filter((o) => set.has(o.id))
}

export async function getActiveOrganizationId() {
  const auth = read(KEYS.AUTH, null)
  if (!auth) return null
  return readRaw(KEYS.ACTIVE_ORG)
}

export async function setActiveOrganizationId(orgId) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  if (orgId === null || orgId === undefined || orgId === '') {
    writeRaw(KEYS.ACTIVE_ORG, null)
    return
  }
  // Validate the user actually belongs to the org they are switching to.
  const memberships = read(KEYS.MEMBERSHIPS, [])
  if (!memberships.some((m) => m.organizationId === orgId && m.userId === auth.userId)) {
    throw new Error('You do not have access to that organization')
  }
  writeRaw(KEYS.ACTIVE_ORG, orgId)
}

// Create a new Organization owned by the current user.
export async function createOrganization({ name, description }) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  // Only the global account is allowed to create new Orgs in this
  // prototype — any signed-in user can spin one up. We don't gate on
  // a permission here because creating your own Org is part of sign-up
  // and onboarding, not Org membership.
  await delay(200)
  const cleanName = (name || '').trim()
  if (!cleanName) throw new Error('Organization name is required')
  const cleanDescription = (description || '').trim()

  const orgs = read(KEYS.ORGANIZATIONS, [])
  const org = {
    id: newOrgId(),
    name: cleanName,
    description: cleanDescription,
    createdById: auth.userId,
    createdAt: new Date().toISOString(),
  }
  orgs.push(org)
  write(KEYS.ORGANIZATIONS, orgs)

  // Seed the Admin + Member system roles for this new Org BEFORE
  // inserting the owner membership. Without these, /members shows
  // "No roles defined" for new Orgs and the role-preset cards on the
  // AddMemberDialog have nothing to render. The owner is implicitly
  // an admin via the roleId === null owner marker (see useCan), so
  // they get every permission without needing an explicit row.
  seedDefaultRolesForOrg(org.id)

  const memberships = read(KEYS.MEMBERSHIPS, [])
  memberships.push({
    organizationId: org.id,
    userId: auth.userId,
    inviteeEmail: null,
    roleId: null, // null marks the Org owner — not removable, not reassignable
    status: 'active',
    joinedAt: org.createdAt,
    invitedAt: null,
  })
  write(KEYS.MEMBERSHIPS, memberships)

  const users = read(KEYS.USERS, [])
  const owner = users.find((u) => u.id === auth.userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: owner?.email || 'unknown',
    action: 'create_organization',
    target: org.id,
    details: `Created organization ${org.name}`,
  })
  return org
}

export async function updateProfile({ name, email, currentPassword, newPassword }) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(250)

  const users = read(KEYS.USERS, [])
  const idx = users.findIndex((u) => u.id === auth.userId)
  if (idx === -1) throw new Error('User not found')
  const user = users[idx]

  if (newPassword) {
    if (!currentPassword || user.passwordHash !== 'mock:' + currentPassword) {
      throw new Error('Current password is incorrect')
    }
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters')
    }
    user.passwordHash = 'mock:' + newPassword
  }

  if (typeof name === 'string' && name.trim()) {
    user.name = name.trim()
  }
  if (typeof email === 'string' && email.trim()) {
    const clean = email.trim().toLowerCase()
    if (clean !== user.email) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
        throw new Error('Invalid email address')
      }
      if (users.some((u) => u.email === clean && u.id !== user.id)) {
        throw new Error('An account with this email already exists')
      }
      user.email = clean
    }
  }

  users[idx] = user
  write(KEYS.USERS, users)

  appendAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'update_profile',
    target: 'self',
    details: 'Profile updated',
  })

  return publicUser(user)
}

function publicUser(u) {
  return { id: u.id, email: u.email, username: u.username, name: u.name, createdAt: u.createdAt }
}

// --- Server Management Key bridge -------------------------------------------

const KEY_FORMAT = /^sm_[a-f0-9]{16,}$/

function cannedServerForKey(key) {
  // Static demo server details — independent of which actual key is used,
  // because we have no real backend to look up the real server. The Open
  // Source Panel currently shows ANY sm_* key for the same singleton.
  const ip = '198.51.100.42'
  return {
    hostname: 'demo.serveravatar.local',
    ip,
    // Panel URL uses nip.io DNS so the host resolves back to the IP.
    // Minted at server-creation time per the contract surfaced in the UI.
    panelUrl: `https://${ip}.nip.io`,
    region: 'EU-Central',
    provider: 'Hetzner Cloud',
    os: 'Ubuntu 24.04 LTS',
    arch: 'x86_64',
    webServer: 'Nginx 1.24.0',
    phpVersion: '8.3.6',
    nodeVersion: 'v20.11.0',
    phpVersions: ['8.3'],
    nodeVersions: ['v20.11.0'],
    memory: { totalMb: 8192, usedMb: 3420 },
    cpu: { cores: 4, loadPct: 12 },
    uptimeSeconds: 345600,
  }
}

function keyPreview(key) {
  if (!key) return ''
  return '...' + key.slice(-8)
}

// Rename an Organization. Only the Org's owner can do this. Does not
// require the active Org to be this one — caller passes the id.
export async function renameOrganization(orgId, name) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(150)
  const cleanName = (name || '').trim()
  if (!cleanName) throw new Error('Organization name is required')

  const orgs = read(KEYS.ORGANIZATIONS, [])
  const idx = orgs.findIndex((o) => o.id === orgId)
  if (idx === -1) throw new Error('Organization not found')
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const ownerRow = memberships.find((m) => m.organizationId === orgId && m.userId === auth.userId)
  if (!ownerRow || ownerRow.roleId !== null) {
    // roleId === null marks the Org owner. Non-null roleId means a
    // member with a real role (Admin / Member / custom).
    throw new Error('Only the organization owner can rename it')
  }
  assertCan(auth.userId, orgId, 'organization.dashboard.manage')
  const oldName = orgs[idx].name
  orgs[idx].name = cleanName
  write(KEYS.ORGANIZATIONS, orgs)

  const users = read(KEYS.USERS, [])
  const owner = users.find((u) => u.id === auth.userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: owner?.email || 'unknown',
    action: 'rename_organization',
    target: orgId,
    details: `Renamed organization ${oldName} to ${cleanName}`,
  })
  return orgs[idx]
}

// Delete an Organization. Only the Org's owner can do this. The user
// must own at least one other Organization (so they always have somewhere
// to land). Deleting also drops memberships for that Org, plus all
// servers and audit entries scoped to it.
export async function deleteOrganization(orgId) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(200)

  const orgs = read(KEYS.ORGANIZATIONS, [])
  const org = orgs.find((o) => o.id === orgId)
  if (!org) throw new Error('Organization not found')
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const ownerRow = memberships.find((m) => m.organizationId === orgId && m.userId === auth.userId)
  if (!ownerRow || ownerRow.roleId !== null) {
    throw new Error('Only the organization owner can delete it')
  }
  // Ensure the user has at least one other Organization.
  const ownedOrgIds = memberships.filter((m) => m.userId === auth.userId && m.roleId === null).map((m) => m.organizationId)
  if (ownedOrgIds.length <= 1) {
    throw new Error('Cannot delete your only organization')
  }
  assertCan(auth.userId, orgId, 'organization.dashboard.manage')

  // Drop the Org.
  const nextOrgs = orgs.filter((o) => o.id !== orgId)
  write(KEYS.ORGANIZATIONS, nextOrgs)

  // Drop memberships scoped to that Org.
  const nextMemberships = memberships.filter((m) => m.organizationId !== orgId)
  write(KEYS.MEMBERSHIPS, nextMemberships)

  // Drop servers scoped to that Org.
  const servers = read(KEYS.SERVERS, [])
  const nextServers = servers.filter((s) => s.orgId !== orgId)
  write(KEYS.SERVERS, nextServers)

  // Drop audit entries scoped to that Org.
  const audit = read(KEYS.AUDIT, [])
  const nextAudit = audit.filter((e) => e.orgId !== orgId)
  write(KEYS.AUDIT, nextAudit)

  // Drop per-server access rows scoped to that Org.
  const accessRows = readServerAccessRows()
  const nextAccess = accessRows.filter((r) => r.organizationId !== orgId)
  write(KEYS.SERVER_ACCESS, nextAccess)

  // Drop roles scoped to that Org (and clear the per-Org seeded sentinel).
  const roles = read(KEYS.ROLES, [])
  const nextRoles = roles.filter((r) => r.organizationId !== orgId)
  write(KEYS.ROLES, nextRoles)
  const seeded = readSeededMap()
  if (seeded[orgId]) {
    delete seeded[orgId]
    writeSeededMap(seeded)
  }

  // If the active Org was the one deleted, fall back to another Org
  // that the user belongs to, or null.
  if (readRaw(KEYS.ACTIVE_ORG) === orgId) {
    const fallbackId = nextMemberships.find((m) => m.userId === auth.userId)?.organizationId || null
    if (fallbackId) writeRaw(KEYS.ACTIVE_ORG, fallbackId)
    else writeRaw(KEYS.ACTIVE_ORG, null)
  }

  const users = read(KEYS.USERS, [])
  const owner = users.find((u) => u.id === auth.userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: owner?.email || 'unknown',
    action: 'delete_organization',
    target: orgId,
    details: `Deleted organization ${org.name}`,
  })
}

// Returns the current user's roleId inside the active Organization.
// null = Org owner, string = roleId of the assigned role, undefined =
// no membership. Prefer `resolveMemberRole()` for the full role object.
export function getCurrentMembershipRole() {
  const auth = read(KEYS.AUTH, null)
  if (!auth) return null
  const activeOrgId = readRaw(KEYS.ACTIVE_ORG)
  if (!activeOrgId) return null
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const row = memberships.find((m) => m.organizationId === activeOrgId && m.userId === auth.userId)
  return row ? row.roleId : undefined
}

// verifyServerByKey — checks the key format and returns the canned server
// preview the Open Source Panel would normally return. Does NOT save the
// connection; that happens after the user confirms in step 3 of the
// Connect Server flow. Add a small delay so the spinner in the UI has
// time to render before the preview card appears.
export async function verifyServerByKey(key) {
  await delay(450)
  const cleanKey = (key || '').trim()
  if (!KEY_FORMAT.test(cleanKey)) {
    throw new Error('Invalid key format — expected sm_<16+ hex chars>')
  }
  return cannedServerForKey(cleanKey)
}

// connectServerByKey — commits the connection after the user has reviewed
// the verified preview (in step 2) and provided a Server Name (in step 3).
// Equivalent to the old addServerByKey, minus the synchronous trust gate.
export async function connectServerByKey(key, { label } = {}) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(350)

  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) throw new Error('No active organization — create or select one first')
  assertCan(auth.userId, orgId, 'organization.servers.manage')

  const cleanKey = (key || '').trim()
  if (!KEY_FORMAT.test(cleanKey)) {
    throw new Error('Invalid key format — expected sm_<16+ hex chars>')
  }

  const users = read(KEYS.USERS, [])
  const owner = users.find((u) => u.id === auth.userId)

  const servers = read(KEYS.SERVERS, [])
  const existing = servers.find((s) => s.keyId === cleanKey)
  if (existing) {
    throw new Error('This server is already connected to your account')
  }

  const details = cannedServerForKey(cleanKey)
  const server = {
    id: newServerId(),
    name: label?.trim() || details.hostname,
    keyId: cleanKey,
    keyPreview: keyPreview(cleanKey),
    connectedById: auth.userId,
    connectedAt: new Date().toISOString(),
    orgId,
    source: 'management_key',
    ...details,
  }
  servers.push(server)
  write(KEYS.SERVERS, servers)

  appendAudit({
    actorId: auth.userId,
    actorEmail: owner?.email || 'unknown',
    action: 'connect_server',
    target: server.id,
    serverId: server.id,
    details: `Connected server ${server.name}`,
  })

  return server
}

// ===========================================================================
// Provider Integrations (cloud VPS providers)
//
// The mock catalog is static — every provider has a fixed list of regions
// and plans, all stored in this file. Real provider API calls land later.
// ===========================================================================

export const PROVIDER_CATALOG = [
  {
    id: 'vultr',
    name: 'Vultr',
    color: '#007BFC',
    tokenPrefix: 'vultr_',
    tokenFormat: /^vultr_[A-Za-z0-9_-]{16,}$/,
    helperText: 'Sign in to your Vultr account, open Account → API Tokens, and create a new Personal Access Token with full access.',
    regions: [
      { id: 'ewr', name: 'New Jersey',  country: 'US',  flag: '🇺🇸' },
      { id: 'lax', name: 'Los Angeles', country: 'US',  flag: '🇺🇸' },
      { id: 'fra', name: 'Frankfurt',   country: 'DE',  flag: '🇩🇪' },
      { id: 'sgp', name: 'Singapore',   country: 'SG',  flag: '🇸🇬' },
    ],
    plans: [
      { id: 'vc2-1c-1gb',  name: '1 vCPU · 1 GB',   vcpu: 1, ramGb: 1,  diskGb: 25,  monthlyUsd: 5,   hourlyUsd: 0.007  },
      { id: 'vc2-2c-4gb',  name: '2 vCPU · 4 GB',   vcpu: 2, ramGb: 4,  diskGb: 80,  monthlyUsd: 24,  hourlyUsd: 0.035  },
      { id: 'vc2-4c-8gb',  name: '4 vCPU · 8 GB',   vcpu: 4, ramGb: 8,  diskGb: 160, monthlyUsd: 48,  hourlyUsd: 0.069  },
    ],
    osOptions: [
      { id: 'ubuntu-24-04',  name: 'Ubuntu 24.04 LTS' },
      { id: 'ubuntu-22-04',  name: 'Ubuntu 22.04 LTS' },
      { id: 'debian-12',     name: 'Debian 12' },
    ],
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    color: '#0080FF',
    tokenPrefix: 'dop_v1_',
    tokenFormat: /^dop_v1_[A-Za-z0-9_-]{20,}$/,
    helperText: 'Sign in to DigitalOcean, open API → Tokens/Generate New Token, name it "Central Panel" and grant Write scope.',
    regions: [
      { id: 'nyc3', name: 'New York 3',     country: 'US',  flag: '🇺🇸' },
      { id: 'sfo3', name: 'San Francisco',  country: 'US',  flag: '🇺🇸' },
      { id: 'ams3', name: 'Amsterdam 3',    country: 'NL',  flag: '🇳🇱' },
      { id: 'sgp1', name: 'Singapore 1',    country: 'SG',  flag: '🇸🇬' },
    ],
    plans: [
      { id: 's-1vcpu-1gb',    name: 'Basic · 1 vCPU · 1 GB',  vcpu: 1, ramGb: 1,  diskGb: 25,  monthlyUsd: 6,   hourlyUsd: 0.00893 },
      { id: 's-2vcpu-4gb',    name: 'Basic · 2 vCPU · 4 GB',  vcpu: 2, ramGb: 4,  diskGb: 80,  monthlyUsd: 24,  hourlyUsd: 0.03571 },
      { id: 's-4vcpu-8gb',    name: 'Basic · 4 vCPU · 8 GB',  vcpu: 4, ramGb: 8,  diskGb: 160, monthlyUsd: 48,  hourlyUsd: 0.07143 },
    ],
    osOptions: [
      { id: 'ubuntu-24-04',  name: 'Ubuntu 24.04 LTS' },
      { id: 'ubuntu-22-04',  name: 'Ubuntu 22.04 LTS' },
      { id: 'debian-12',     name: 'Debian 12' },
    ],
  },
  {
    id: 'linode',
    name: 'Linode',
    color: '#00A95C',
    tokenPrefix: 'linode_',
    tokenFormat: /^[a-f0-9]{64}$/i,
    helperText: 'Log in to Linode Cloud Manager, go to My Profile → API Tokens, and create a Personal Access Token with full account access.',
    regions: [
      { id: 'us-east',    name: 'Newark, NJ',       country: 'US', flag: '🇺🇸' },
      { id: 'us-west',    name: 'Fremont, CA',      country: 'US', flag: '🇺🇸' },
      { id: 'eu-west',    name: 'London, UK',       country: 'UK', flag: '🇬🇧' },
      { id: 'ap-south',   name: 'Singapore',        country: 'SG', flag: '🇸🇬' },
    ],
    plans: [
      { id: 'g6-nanode-1',  name: 'Nanode · 1 vCPU · 1 GB', vcpu: 1, ramGb: 1, diskGb: 25,  monthlyUsd: 5,   hourlyUsd: 0.0075 },
      { id: 'g6-dedicated-2', name: 'Dedicated · 2 vCPU · 4 GB', vcpu: 2, ramGb: 4, diskGb: 80, monthlyUsd: 24, hourlyUsd: 0.036 },
      { id: 'g6-dedicated-4', name: 'Dedicated · 4 vCPU · 8 GB', vcpu: 4, ramGb: 8, diskGb: 160, monthlyUsd: 48, hourlyUsd: 0.072 },
    ],
    osOptions: [
      { id: 'linode/ubuntu24.04', name: 'Ubuntu 24.04 LTS' },
      { id: 'linode/ubuntu22.04', name: 'Ubuntu 22.04 LTS' },
      { id: 'linode/debian12',    name: 'Debian 12' },
    ],
  },
  {
    id: 'hetzner',
    name: 'Hetzner Cloud',
    color: '#D50C2D',
    tokenPrefix: 'hc_',
    tokenFormat: /^[A-Za-z0-9_-]{20,}$/,
    helperText: 'Sign in to Hetzner Cloud Console, go to Security → API Tokens, and generate a token with Read & Write scope.',
    regions: [
      { id: 'fsn1',  name: 'Falkenstein', country: 'DE', flag: '🇩🇪' },
      { id: 'nbg1',  name: 'Nuremberg',   country: 'DE', flag: '🇩🇪' },
      { id: 'hel1',  name: 'Helsinki',    country: 'FI', flag: '🇫🇮' },
      { id: 'ash',   name: 'Ashburn, VA', country: 'US', flag: '🇺🇸' },
    ],
    plans: [
      { id: 'cx22', name: 'CX22 · 2 vCPU · 4 GB',  vcpu: 2, ramGb: 4,  diskGb: 40,  monthlyUsd: 4.85, hourlyUsd: 0.0070 },
      { id: 'cx32', name: 'CX32 · 4 vCPU · 8 GB',  vcpu: 4, ramGb: 8,  diskGb: 80,  monthlyUsd: 8.91, hourlyUsd: 0.0130 },
      { id: 'cx42', name: 'CX42 · 8 vCPU · 16 GB', vcpu: 8, ramGb: 16, diskGb: 160, monthlyUsd: 17.49, hourlyUsd: 0.0257 },
    ],
    osOptions: [
      { id: 'ubuntu-24.04', name: 'Ubuntu 24.04' },
      { id: 'ubuntu-22.04', name: 'Ubuntu 22.04' },
      { id: 'debian-12',    name: 'Debian 12' },
    ],
  },
]

// listProviders — return the connected providers for the active Org.
// Each entry: { id, orgId, provider, label, tokenPreview, connectedAt, connectedById }
// `provider` is one of the PROVIDER_CATALOG ids (e.g. 'vultr').
export async function listProviders() {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(80)
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) return []
  const all = read(KEYS.PROVIDERS, [])
  return all.filter((p) => p.orgId === orgId)
}

// listProviderCatalog — expose the static catalog so the wizard and the
// Integrations page share the same source of truth.
export async function listProviderCatalog() {
  return PROVIDER_CATALOG
}

// connectProvider — simulate verifying a token, then store the integration.
// Throws on invalid token format or empty label; the caller (UI) shows the
// error toast. Multiple accounts per provider are allowed (one record per
// `(orgId, provider, label)` tuple — label collisions throw).
export async function connectProvider({ provider: providerId, label, token }) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(900) // simulate token verification round-trip
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) throw new Error('No active organization')

  const catalog = PROVIDER_CATALOG.find((p) => p.id === providerId)
  if (!catalog) throw new Error('Unknown provider')

  const cleanLabel = (label || '').trim()
  if (!cleanLabel) throw new Error('Label is required — it distinguishes this account from others of the same provider')

  const cleanToken = (token || '').trim()
  if (!cleanToken) throw new Error('Token is required')
  if (catalog.tokenFormat && !catalog.tokenFormat.test(cleanToken)) {
    throw new Error(
      `Token format invalid — ${catalog.name} tokens look like "${catalog.tokenPrefix}…"`,
    )
  }

  const all = read(KEYS.PROVIDERS, [])
  // Multiple accounts per provider are allowed, but two accounts may not
  // share the same label within an Org. Otherwise renaming and the
  // server-list rendering become ambiguous.
  const dup = all.find((p) => p.orgId === orgId && p.provider === providerId && p.label === cleanLabel)
  if (dup) {
    throw new Error(`An account named "${cleanLabel}" already exists for ${catalog.name} in this organization`)
  }

  const users = read(KEYS.USERS, [])
  const actor = users.find((u) => u.id === auth.userId)
  const record = {
    id: uid('prv'),
    orgId,
    provider: providerId,
    label: cleanLabel,
    tokenPreview: '••••' + cleanToken.slice(-4),
    connectedAt: new Date().toISOString(),
    connectedById: auth.userId,
  }
  all.push(record)
  write(KEYS.PROVIDERS, all)

  appendAudit({
    actorId: auth.userId,
    actorEmail: actor?.email || 'unknown',
    action: 'connect_provider',
    target: record.id,
    details: `Connected ${catalog.name} (${cleanLabel})`,
  })

  return record
}

// renameProviderAccount — update the label on an existing provider account.
// Throws if the new label collides with another account of the same provider
// in the same Org. No audit entry (rename is cosmetic).
export async function renameProviderAccount(providerIntegrationId, newLabel) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(100)
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) throw new Error('No active organization')

  const cleanLabel = (newLabel || '').trim()
  if (!cleanLabel) throw new Error('Label is required')

  const all = read(KEYS.PROVIDERS, [])
  const idx = all.findIndex((p) => p.id === providerIntegrationId && p.orgId === orgId)
  if (idx === -1) throw new Error('Provider account not found')

  const conflict = all.find(
    (p) => p.id !== providerIntegrationId && p.orgId === orgId && p.provider === all[idx].provider && p.label === cleanLabel,
  )
  if (conflict) throw new Error(`Another ${all[idx].provider} account already uses that label`)

  all[idx].label = cleanLabel
  write(KEYS.PROVIDERS, all)
  return all[idx]
}

// countServersUsingProviderAccount — helper for the disconnect guard.
// Returns the number of server records in the active Org that reference
// this provider account. Used by the UI to block disconnect when > 0.
export async function countServersUsingProviderAccount(providerIntegrationId) {
  await delay(40)
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) return 0
  const servers = read(KEYS.SERVERS, [])
  return servers.filter(
    (s) => s.orgId === orgId && s.source === 'provider' && s.sourceDetail?.providerAccountId === providerIntegrationId,
  ).length
}

// disconnectProvider — remove a specific integration account (not the whole
// provider brand). Caller should confirm first when there are connected
// servers referencing this account (use countServersUsingProviderAccount).
export async function disconnectProvider(providerIntegrationId) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(180)
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) throw new Error('No active organization')

  const all = read(KEYS.PROVIDERS, [])
  const record = all.find((p) => p.id === providerIntegrationId && p.orgId === orgId)
  if (!record) throw new Error('Provider account not found')

  // Hard guard: refuse to disconnect an account that still has servers
  // pointing at it. The UI surfaces this count in the disconnect confirm
  // dialog and blocks the action entirely.
  const servers = read(KEYS.SERVERS, [])
  const using = servers.filter(
    (s) => s.orgId === orgId && s.source === 'provider' && s.sourceDetail?.providerAccountId === providerIntegrationId,
  )
  if (using.length > 0) {
    throw new Error(
      `${using.length} server${using.length === 1 ? '' : 's'} still use this account. ` +
      `Reconnect each server to a different account first, then disconnect.`,
    )
  }

  const catalog = PROVIDER_CATALOG.find((p) => p.id === record.provider)
  const users = read(KEYS.USERS, [])
  const actor = users.find((u) => u.id === auth.userId)

  const next = all.filter((p) => p.id !== providerIntegrationId)
  write(KEYS.PROVIDERS, next)

  appendAudit({
    actorId: auth.userId,
    actorEmail: actor?.email || 'unknown',
    action: 'disconnect_provider',
    target: providerIntegrationId,
    details: `Disconnected ${catalog?.name || record.provider} (${record.label})`,
  })

  return { ok: true }
}

// ===========================================================================
// Create Server — Custom VPS / Provider
//
// Simulated multi-stage provisioning pipeline. The wizard collects the
// config, then calls createServer which yields progress events back to the
// caller via the onProgress callback. Final result is a unified server
// record (same shape as connectServerByKey) so the list / dashboard /
// detail pages don't have to branch on source.
// ===========================================================================

// Stage definitions, one per branch. Keep the array length small (6) so the
// progress UI doesn't feel like a spinner marathon.
export const CREATE_STAGES = {
  custom_vps: [
    { id: 'verify_ssh',     label: 'Verifying SSH access' },
    { id: 'compat_check',   label: 'Checking compatibility' },
    { id: 'prepare',        label: 'Preparing server' },
    { id: 'install_osp',    label: 'Installing ServerAvatar' },
    { id: 'start_services', label: 'Starting services' },
    { id: 'establish_key',  label: 'Establishing Central Panel access' },
    { id: 'finalize',       label: 'Finalizing setup' },
  ],
  provider: [
    { id: 'create_vps',     label: 'Creating VPS' },
    { id: 'wait_boot',      label: 'Waiting for server' },
    { id: 'prepare',        label: 'Preparing server' },
    { id: 'install_osp',    label: 'Installing ServerAvatar' },
    { id: 'start_services', label: 'Starting services' },
    { id: 'establish_key',  label: 'Establishing Central Panel access' },
    { id: 'finalize',       label: 'Finalizing setup' },
  ],
}

// Human-readable estimate shown once under the progress bar — not exposed
// per-stage, so the UI doesn't fake timing precision. Ranges match what a
// real installer typically takes (VPS creation + open-source panel
// install + service start). Internal mock delays below stay fast for
// demo.
export const CREATE_ESTIMATES = {
  custom_vps: { label: '3–5 minutes', minMinutes: 3, maxMinutes: 5 },
  provider:   { label: '5–7 minutes', minMinutes: 5, maxMinutes: 7 },
}

// Per-stage mock delays (ms). Tuned so the whole flow finishes in ~9s
// for provider and ~6s for custom VPS. Change here to slow / speed up.
const STAGE_DELAYS = {
  custom_vps: {
    verify_ssh: 900, compat_check: 700, prepare: 600,
    install_osp: 1100, start_services: 600, establish_key: 800, finalize: 600,
  },
  provider: {
    create_vps: 1500, wait_boot: 1200, prepare: 700,
    install_osp: 1300, start_services: 700, establish_key: 900, finalize: 700,
  },
}

// verifySsh — used by the Custom VPS branch before the user clicks "Create".
// Validates input shape and returns canned server info. Throws on obvious
// failures (empty fields, malformed IP/port).
//
// Demo behaviour: any password starting with `fail` triggers a realistic
// auth failure so the error-state UI is reachable without a real SSH
// connection. This is a development-only convenience — the next section
// will pass-through to a real SSH probe once the Open Source Panel
// supports it.

// SUPPORTED_OS_IDS — central catalog of Linux distributions the Open
// Source Panel installer is currently validated against. Exported for
// the Create Server UI to render the support list, and used by the
// Custom VPS verify step to flag unsupported detections.
export const SUPPORTED_OS_IDS = ['ubuntu-24-04', 'ubuntu-22-04', 'debian-12']

export const SUPPORTED_OS_LABELS = {
  'ubuntu-24-04': 'Ubuntu 24.04 LTS',
  'ubuntu-22-04': 'Ubuntu 22.04 LTS',
  'debian-12':    'Debian 12',
}

// Human-readable list of supported OSes, in display order. UI components
// import this instead of re-deriving the catalog so the wording stays in
// one place.
export const SUPPORTED_OS_LIST = [
  SUPPORTED_OS_LABELS['ubuntu-24-04'],
  SUPPORTED_OS_LABELS['ubuntu-22-04'],
  SUPPORTED_OS_LABELS['debian-12'],
] // supported Linux VPSes (intentionally generic — no "any Ubuntu/Debian/CentOS" promise)

export async function verifySsh({ ip, port, user, password }) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(700) // simulate TCP handshake + auth
  const cleanIp = (ip || '').trim()
  const cleanPort = Number(port || 22)
  const cleanUser = (user || '').trim()
  const cleanPass = (password || '').trim()
  if (!cleanIp) throw new Error('IP address is required')
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(cleanIp)) {
    throw new Error('IP address looks invalid (expected IPv4)')
  }
  if (!Number.isInteger(cleanPort) || cleanPort < 1 || cleanPort > 65535) {
    throw new Error('SSH port must be between 1 and 65535')
  }
  if (!cleanUser) throw new Error('SSH user is required')
  if (!cleanPass) throw new Error('SSH password is required')
  // Demo trigger for the error-state UI. A password starting with "fail"
  // simulates an authentication failure so the user can see the proper
  // error UI without needing a real SSH server to be unreachable.
  if (/^fail/i.test(cleanPass)) {
    throw new Error('SSH authentication failed (check username and password)')
  }

  // Demo: derive a fake hostname from the IP so the server record has
  // something distinctive in the list. The same IP-last-octet pattern
  // also drives a deterministic OS-detection preview so the UI can
  // surface "detected OS + whether it is supported" without needing a
  // real SSH probe.
  const last = cleanIp.split('.').pop().padStart(3, '0')
  const hostname = `custom-${last}.central.local`

  // Demo OS detection — fixed catalog mapping per IP-last-octet. Real
  // detection (reading /etc/os-release) is left for the Open Source
  // Panel to implement against the SSH probe it runs during install.
  //
  // Pattern mod 4:
  //   0 → Ubuntu 24.04 LTS   (supported)
  //   1 → Ubuntu 22.04 LTS   (supported)
  //   2 → Debian 12          (supported)
  //   3 → CentOS 7           (NOT supported by current installer)
  // That gives the UI a mix of supported + unsupported paths without
  // any real network call.
  const lastNum = Number.parseInt(last, 10) || 0
  const detectedOs = [
    { id: 'ubuntu-24-04', name: 'Ubuntu 24.04 LTS', supported: true },
    { id: 'ubuntu-22-04', name: 'Ubuntu 22.04 LTS', supported: true },
    { id: 'debian-12',    name: 'Debian 12',       supported: true },
    { id: 'centos-7',     name: 'CentOS 7',        supported: false },
  ][lastNum % 4]

  return {
    hostname,
    ip: cleanIp,
    port: cleanPort,
    user: cleanUser,
    os: detectedOs.name,
    osId: detectedOs.id,
    osSupported: detectedOs.supported,
    arch: 'x86_64',
    region: 'Custom (existing VPS)',
    provider: 'Custom VPS',
    webServer: 'Nginx 1.24.0',
    phpVersion: '8.3.6',
    nodeVersion: 'v20.11.0',
    phpVersions: ['8.3'],
    nodeVersions: ['v20.11.0'],
    memory: { totalMb: 4096, usedMb: 1820 },
    cpu: { cores: 2, loadPct: 18 },
    uptimeSeconds: 86400,
    compatible: true,
  }
}

// createServer — unified entry point for both Create branches.
// `payload` shape:
//   { source: 'provider',   providerId, regionId, planId, osId, name }
//   { source: 'custom_vps', ip, port, user, password, name }
// `onProgress(stageId, status)` is called for each stage transition where
// status is one of 'active', 'done', 'failed'. Throws on hard failure;
// callers can render the failed state via onProgress.
//
// Returns the new server record (same shape as connectServerByKey).
export async function createServer(payload, onProgress) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) throw new Error('No active organization')
  assertCan(auth.userId, orgId, 'organization.servers.manage')

  const source = payload?.source
  if (source !== 'provider' && source !== 'custom_vps') {
    throw new Error('Unsupported server source')
  }

  const stages = CREATE_STAGES[source]
  const delays = STAGE_DELAYS[source]

  // Multi-account: when the user has multiple accounts of this provider
  // the wizard must specify which one is paying. If exactly one account
  // exists we default to it silently so a single-account flow has no
  // picker step. Multi-account without an explicit choice throws so the
  // UI surfaces a picker.
  if (source === 'provider') {
    const providers = read(KEYS.PROVIDERS, [])
    const accounts = providers.filter((p) => p.orgId === orgId && p.provider === payload.providerId)
    if (accounts.length > 1 && !payload.providerAccountId) {
      throw new Error('Pick which account will be billed for this server')
    }
    if (accounts.length === 1 && !payload.providerAccountId) {
      payload = { ...payload, providerAccountId: accounts[0].id }
    }
    if (payload.providerAccountId) {
      const ok = accounts.find((a) => a.id === payload.providerAccountId)
      if (!ok) throw new Error('Selected provider account is not connected')
    }
  }

  // Resolve target server details BEFORE the staged pipeline so we can
  // surface failures (e.g. unknown provider / plan) up front rather than
  // mid-progress.
  const details = resolveServerDetails(source, payload)
  const users = read(KEYS.USERS, [])
  const actor = users.find((u) => u.id === auth.userId)

  // Generate the management key the installer would have generated. In the
  // demo this is just a random sm_ string — we persist it on the server
  // record so a future Connect-by-key flow (or a debugging session) can
  // reference it. The UI never shows it to the user.
  const keyBytes = new Uint8Array(16)
  if (inBrowser() && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(keyBytes)
  } else {
    for (let i = 0; i < keyBytes.length; i++) keyBytes[i] = Math.floor(Math.random() * 256)
  }
  const keyHex = Array.from(keyBytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  const fullKey = `sm_${keyHex}`

  const baseRecord = {
    id: newServerId(),
    name: (payload?.name || '').trim() || details.hostname,
    keyId: fullKey,
    keyPreview: keyPreview(fullKey),
    connectedById: auth.userId,
    connectedAt: new Date().toISOString(),
    orgId,
    source,
    sourceDetail: source === 'provider'
      ? {
          providerId: payload.providerId,
          providerAccountId: payload.providerAccountId || null,
          providerAccountLabel: payload.providerAccountId ? (() => {
            const providers = read(KEYS.PROVIDERS, [])
            const acc = providers.find((p) => p.id === payload.providerAccountId)
            return acc?.label || null
          })() : null,
          regionId: payload.regionId,
          planId: payload.planId,
          osId: payload.osId,
        }
      : { ip: details.ip, port: details.port, user: details.user },
    ...details,
  }

  // Run the staged progress pipeline.
  for (const stage of stages) {
    if (typeof onProgress === 'function') {
      onProgress(stage.id, 'active')
    }
    await delay(delays[stage.id] ?? 600)
    if (typeof onProgress === 'function') {
      onProgress(stage.id, 'done')
    }
  }

  // Persist the server record AFTER the pipeline finishes successfully.
  const servers = read(KEYS.SERVERS, [])
  servers.push(baseRecord)
  write(KEYS.SERVERS, servers)

  // Auto-share the new server with every Org member whose role grants
  // `organization.servers.manage` so they don't need a manual Share
  // step before they can manage it. New cp_server_access rows get
  // `grantedById: null` since this isn't a user-initiated grant.
  autoShareNewServerWithManageMembers(orgId, baseRecord.id)

  appendAudit({
    actorId: auth.userId,
    actorEmail: actor?.email || 'unknown',
    action: source === 'provider' ? 'create_server_provider' : 'create_server_custom_vps',
    target: baseRecord.id,
    serverId: baseRecord.id,
    details: `${source === 'provider' ? 'Provisioned' : 'Installed on'} ${baseRecord.name} via ${source === 'provider' ? details.provider : 'SSH'}`,
  })

  return baseRecord
}

// resolveServerDetails — builds the cannedDetails block the new server
// record gets. Pulls from the provider catalog + plan + region when source
// is 'provider', or echoes the verified SSH info when 'custom_vps'.
function resolveServerDetails(source, payload) {
  if (source === 'custom_vps') {
    return {
      hostname: `custom-${(payload.ip || '').replace(/\./g, '-')}.central.local`,
      ip: payload.ip,
      panelUrl: payload.ip ? `https://${payload.ip}.nip.io` : null,
      region: 'Custom (existing VPS)',
      provider: 'Custom VPS',
      os: 'Ubuntu 22.04 LTS',
      arch: 'x86_64',
      webServer: 'Nginx 1.24.0',
      phpVersion: '8.3.6',
      nodeVersion: 'v20.11.0',
      phpVersions: ['8.3'],
      nodeVersions: ['v20.11.0'],
      memory: { totalMb: 4096, usedMb: 1820 },
      cpu: { cores: 2, loadPct: 18 },
      uptimeSeconds: 0,
    }
  }
  const catalog = PROVIDER_CATALOG.find((p) => p.id === payload.providerId)
  if (!catalog) throw new Error('Selected provider is not connected')
  const region = catalog.regions.find((r) => r.id === payload.regionId)
  const plan = catalog.plans.find((p) => p.id === payload.planId)
  const osOption = catalog.osOptions.find((o) => o.id === payload.osId)
  if (!region) throw new Error('Selected region is not available for this provider')
  if (!plan) throw new Error('Selected plan is not available for this provider')
  if (!osOption) throw new Error('Selected OS is not available for this provider')
  // Canned stats that scale loosely with the plan so the dashboard card
  // looks plausible across the three size tiers.
  const ip = `203.0.113.${Math.floor(Math.random() * 200) + 10}`
  return {
    hostname: `${catalog.id}-${region.id}-${plan.id.slice(0, 6)}.central.local`,
    ip,
    panelUrl: `https://${ip}.nip.io`,
    region: `${region.name}, ${region.country}`,
    provider: catalog.name,
    os: osOption.name,
    arch: 'x86_64',
    webServer: 'Nginx 1.24.0',
    phpVersion: '8.3.6',
    nodeVersion: 'v20.11.0',
    phpVersions: ['8.3'],
    nodeVersions: ['v20.11.0'],
    memory: { totalMb: plan.ramGb * 1024, usedMb: Math.round(plan.ramGb * 1024 * 0.35) },
    cpu: { cores: plan.vcpu, loadPct: 8 },
    uptimeSeconds: 0,
  }
}

export async function listServers() {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(80)
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) return []
  const servers = read(KEYS.SERVERS, [])
  // Backfill panelUrl for servers created before the field was added
  // (older demo sessions have rows in localStorage without it). Fresh
  // records get it from createServer/connectServerByKey directly.
  return servers
    .filter((s) => s.orgId === orgId)
    .map((s) =>
      s.panelUrl || !s.ip ? s : { ...s, panelUrl: `https://${s.ip}.nip.io` }
    )
}

export async function getServer(id) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(80)
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) return null
  const servers = read(KEYS.SERVERS, [])
  return servers.find((s) => s.id === id && s.orgId === orgId) || null
}

export async function disconnectServer(id) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(200)

  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) throw new Error('No active organization')
  assertCan(auth.userId, orgId, 'organization.servers.manage')
  const servers = read(KEYS.SERVERS, [])
  const idx = servers.findIndex((s) => s.id === id && s.orgId === orgId)
  if (idx === -1) throw new Error('Server not found')
  const removed = servers[idx]
  servers.splice(idx, 1)
  write(KEYS.SERVERS, servers)

  // Cascade: drop every per-member access row pointing at this server.
  // Disconnecting the server makes any grants meaningless.
  const accessRows = readServerAccessRows()
  const accessNext = accessRows.filter((r) => !(r.organizationId === orgId && r.serverId === id))
  if (accessNext.length !== accessRows.length) write(KEYS.SERVER_ACCESS, accessNext)

  const users = read(KEYS.USERS, [])
  const owner = users.find((u) => u.id === auth.userId)

  appendAudit({
    actorId: auth.userId,
    actorEmail: owner?.email || 'unknown',
    action: 'disconnect_server',
    target: id,
    serverId: id,
    details: `Disconnected server ${removed.name}`,
  })
}

// Bulk disconnect — disconnects multiple servers in one call. Same
// permission gate and audit behavior as disconnectServer, just applied
// per id. Returns the list of disconnected server ids + names so the
// UI can show a success toast and refresh its view.
//
// Refuses to act on ids that don't belong to the active Org (defense
// in depth — the UI should never pass such ids, but bulk endpoints are
// a place where client bugs can leak through).
export async function bulkDisconnectServers(serverIds = []) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  const cleanIds = Array.from(new Set((serverIds || []).filter(Boolean)))
  if (cleanIds.length === 0) throw new Error('No servers selected')

  await delay(300)
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) throw new Error('No active organization')
  assertCan(auth.userId, orgId, 'organization.servers.manage')

  const servers = read(KEYS.SERVERS, [])
  // Only act on ids that match both the request and the active Org —
  // silently ignore any id that doesn't belong here so a malformed
  // payload can't poison unrelated Orgs.
  const targetSet = new Set(cleanIds)
  const targetServers = servers.filter((s) => targetSet.has(s.id) && s.orgId === orgId)
  if (targetServers.length === 0) throw new Error('No matching servers in this organization')

  const remaining = servers.filter((s) => !(targetSet.has(s.id) && s.orgId === orgId))
  write(KEYS.SERVERS, remaining)

  // Cascade: drop every per-member access row pointing at any of the
  // disconnected servers in one pass.
  const targetServerIdSet = new Set(targetServers.map((s) => s.id))
  const accessRows = readServerAccessRows()
  const accessNext = accessRows.filter(
    (r) => !(r.organizationId === orgId && targetServerIdSet.has(r.serverId))
  )
  if (accessNext.length !== accessRows.length) write(KEYS.SERVER_ACCESS, accessNext)

  // One audit row per disconnected server so the audit log preserves
  // per-server traceability (a single bulk entry would lose that).
  const users = read(KEYS.USERS, [])
  const owner = users.find((u) => u.id === auth.userId)
  for (const s of targetServers) {
    appendAudit({
      actorId: auth.userId,
      actorEmail: owner?.email || 'unknown',
      action: 'disconnect_server',
      target: s.id,
      serverId: s.id,
      details: targetServers.length === 1
        ? `Disconnected server ${s.name}`
        : `Disconnected server ${s.name} (bulk, ${targetServers.length} total)`,
    })
  }

  return {
    disconnectedServerIds: targetServers.map((s) => s.id),
    disconnectedServerNames: targetServers.map((s) => s.name),
  }
}

export async function renameServer(id, newName) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(150)
  const clean = (newName || '').trim()
  if (!clean) throw new Error('Name is required')

  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) throw new Error('No active organization')
  assertCan(auth.userId, orgId, 'organization.servers.manage')
  const servers = read(KEYS.SERVERS, [])
  const idx = servers.findIndex((s) => s.id === id && s.orgId === orgId)
  if (idx === -1) throw new Error('Server not found')
  servers[idx].name = clean
  write(KEYS.SERVERS, servers)
  return servers[idx]
}

export async function runServerAction(serverId, actionName, status = 'ok', details = '') {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(800)
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) throw new Error('No active organization')
  // Actions that mutate the server (restart, reload, change PHP) require
  // server.manage. View-only actions (view_server_info, view_disk_usage)
  // require server.view. The action names are passed through from the UI,
  // so we map action-prefix to permission here.
  const actionPerm = actionName.startsWith('view_') ? 'organization.servers.view' : 'organization.servers.manage'
  assertCan(auth.userId, orgId, actionPerm)
  const users = read(KEYS.USERS, [])
  const owner = users.find((u) => u.id === auth.userId)
  const servers = read(KEYS.SERVERS, [])
  const server = servers.find((s) => s.id === serverId && s.orgId === orgId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: owner?.email || 'unknown',
    action: actionName,
    target: serverId,
    serverId,
    details: details || actionName,
  })
  return { status, serverName: server?.name }
}

export async function getServerDiskUsage(serverId) {
  await delay(500)
  return [
    { mount: '/', usedGb: 34, totalGb: 80, freeGb: 46 },
    { mount: '/var', usedGb: 21, totalGb: 60, freeGb: 39 },
    { mount: '/tmp', usedGb: 2, totalGb: 10, freeGb: 8 },
    { mount: '/var/log', usedGb: 4, totalGb: 20, freeGb: 16 },
  ]
}

// --- Per-server member access -----------------------------------------------

// Read all access rows. The owner (`roleId === null` in cp_memberships)
// implicitly has access to every server; we don't store that as a row.
function readServerAccessRows() {
  return read(KEYS.SERVER_ACCESS, [])
}

// Sync helper: does `userId` have access to `serverId` in `orgId`?
// Owners bypass the rows and return true. Pending invites (`userId`
// null) have no access yet — they have to register first.
export function hasServerAccess(orgId, serverId, userId) {
  if (!orgId || !serverId || !userId) return false
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const me = memberships.find((m) => m.organizationId === orgId && m.userId === userId)
  if (me && me.roleId === null) return true // owner
  const rows = readServerAccessRows()
  return rows.some((r) => r.organizationId === orgId && r.serverId === serverId && r.userId === userId)
}

// List access rows for one server. Returns a shape suitable for
// rendering: each entry includes the user (hydrated), the role
// (hydrated), and grant metadata. Owners are NOT auto-included —
// callers that want "all who can access this" should fold the owner
// in explicitly (use hasServerAccess for that).
export async function listServerAccessForServer(serverId) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(80)
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) return []
  const rows = readServerAccessRows().filter((r) => r.serverId === serverId && r.organizationId === orgId)
  const users = read(KEYS.USERS, [])
  const roles = read(KEYS.ROLES, [])
  return rows.map((r) => ({
    id: r.id,
    serverId: r.serverId,
    user: publicUser(users.find((u) => u.id === r.userId)),
    userId: r.userId,
    role: roles.find((rl) => rl.id === r.roleId) || null,
    roleId: r.roleId,
    grantedById: r.grantedById,
    grantedAt: r.grantedAt,
  })).filter((r) => r.user)
}

// Inverse: list access rows for one user across all servers in the
// active Org. Returned shape mirrors listServerAccessForServer but
// with server info in place of user info.
export async function listServerAccessForUser(userId) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(80)
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) return []
  const rows = readServerAccessRows().filter((r) => r.userId === userId && r.organizationId === orgId)
  const servers = read(KEYS.SERVERS, [])
  const roles = read(KEYS.ROLES, [])
  return rows.map((r) => ({
    id: r.id,
    serverId: r.serverId,
    server: servers.find((s) => s.id === r.serverId) || null,
    role: roles.find((rl) => rl.id === r.roleId) || null,
    roleId: r.roleId,
    grantedById: r.grantedById,
    grantedAt: r.grantedAt,
  })).filter((r) => r.server)
}

// --- Teams -------------------------------------------------------------------

export async function listTeams() {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(80)
  const teams = read(KEYS.TEAMS, [])
  // Hydrate with member emails for display
  const users = read(KEYS.USERS, [])
  return teams.map((t) => ({
    ...t,
    members: t.members.map((m) => {
      const u = users.find((x) => x.id === m.userId)
      return { ...m, email: u?.email, name: u?.name, username: u?.username }
    }),
  }))
}

export async function createTeam({ name }) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(200)
  const clean = (name || '').trim()
  if (!clean) throw new Error('Team name is required')

  const teams = read(KEYS.TEAMS, [])
  const team = {
    id: newTeamId(),
    name: clean,
    ownerId: auth.userId,
    members: [{ userId: auth.userId, role: 'owner' }],
    createdAt: new Date().toISOString(),
  }
  teams.push(team)
  write(KEYS.TEAMS, teams)

  const users = read(KEYS.USERS, [])
  const owner = users.find((u) => u.id === auth.userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: owner?.email || 'unknown',
    action: 'create_team',
    target: team.id,
    details: `Created team ${team.name}`,
  })
  return team
}

export async function renameTeam(teamId, name) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(150)
  const clean = (name || '').trim()
  if (!clean) throw new Error('Team name is required')

  const teams = read(KEYS.TEAMS, [])
  const idx = teams.findIndex((t) => t.id === teamId)
  if (idx === -1) throw new Error('Team not found')
  if (teams[idx].ownerId !== auth.userId) throw new Error('Only the team owner can rename it')
  teams[idx].name = clean
  write(KEYS.TEAMS, teams)
  return teams[idx]
}

export async function deleteTeam(teamId) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(200)
  const teams = read(KEYS.TEAMS, [])
  const team = teams.find((t) => t.id === teamId)
  if (!team) throw new Error('Team not found')
  if (team.ownerId !== auth.userId) throw new Error('Only the team owner can delete it')
  if (teams.filter((t) => t.ownerId === auth.userId).length <= 1) {
    throw new Error('Cannot delete your only team')
  }
  const next = teams.filter((t) => t.id !== teamId)
  write(KEYS.TEAMS, next)

  const users = read(KEYS.USERS, [])
  const owner = users.find((u) => u.id === auth.userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: owner?.email || 'unknown',
    action: 'delete_team',
    target: teamId,
    details: `Deleted team ${team.name}`,
  })
}

export async function addTeamMember(teamId, email, role) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(200)

  const cleanEmail = (email || '').trim().toLowerCase()
  const users = read(KEYS.USERS, [])
  const userToAdd = users.find((u) => u.email === cleanEmail)
  if (!userToAdd) throw new Error('No Central Panel user with that email yet — ask them to register first')

  const teams = read(KEYS.TEAMS, [])
  const team = teams.find((t) => t.id === teamId)
  if (!team) throw new Error('Team not found')
  if (team.ownerId !== auth.userId) throw new Error('Only the team owner can add members')
  if (team.members.some((m) => m.userId === userToAdd.id)) {
    throw new Error('User is already a member of this team')
  }
  const validRoles = ['admin', 'member', 'viewer']
  const safeRole = validRoles.includes(role) ? role : 'member'
  team.members.push({ userId: userToAdd.id, role: safeRole })
  write(KEYS.TEAMS, teams)

  const owner = users.find((u) => u.id === auth.userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: owner?.email || 'unknown',
    action: 'add_team_member',
    target: teamId,
    details: `Added ${userToAdd.email} as ${safeRole} to ${team.name}`,
  })
}

export async function removeTeamMember(teamId, userId) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(200)

  const teams = read(KEYS.TEAMS, [])
  const team = teams.find((t) => t.id === teamId)
  if (!team) throw new Error('Team not found')
  if (team.ownerId !== auth.userId) throw new Error('Only the team owner can remove members')
  if (userId === team.ownerId) throw new Error('Cannot remove the team owner')
  team.members = team.members.filter((m) => m.userId !== userId)
  write(KEYS.TEAMS, teams)

  const users = read(KEYS.USERS, [])
  const owner = users.find((u) => u.id === auth.userId)
  const removed = users.find((u) => u.id === userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: owner?.email || 'unknown',
    action: 'remove_team_member',
    target: teamId,
    details: `Removed ${removed?.email || userId} from ${team.name}`,
  })
}

export async function changeTeamMemberRole(teamId, userId, role) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(200)
  const validRoles = ['admin', 'member', 'viewer']
  if (!validRoles.includes(role)) throw new Error('Invalid role')

  const teams = read(KEYS.TEAMS, [])
  const team = teams.find((t) => t.id === teamId)
  if (!team) throw new Error('Team not found')
  if (team.ownerId !== auth.userId) throw new Error('Only the team owner can change roles')
  const m = team.members.find((x) => x.userId === userId)
  if (!m) throw new Error('Member not found')
  if (userId === team.ownerId) throw new Error('Cannot change the owner role')
  m.role = role
  write(KEYS.TEAMS, teams)

  const users = read(KEYS.USERS, [])
  const owner = users.find((u) => u.id === auth.userId)
  appendAudit({
    actorId: auth.userId,
    actorEmail: owner?.email || 'unknown',
    action: 'change_team_role',
    target: teamId,
    details: `Changed role of ${userId} to ${role} in ${team.name}`,
  })
}

// --- Members (lists all users who registered for this Central Panel) -------

export async function listMembers() {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(60)
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) return []
  assertCan(auth.userId, orgId, 'organization.members.view')
  return hydrateMembers(orgId)
}

// removeMember is replaced by removeOrgMember (it used to delete the
// Central Panel user entirely, which is destructive across Orgs).
// Keep a stub that throws so accidental callers fail loudly instead of
// silently deleting a user from the demo.
export async function removeMember(userId) {
  throw new Error('removeMember is deprecated — use removeOrgMember instead')
}

// --- Audit log ---------------------------------------------------------------

function appendAudit({ actorId, actorEmail, action, target, serverId, details }) {
  const list = read(KEYS.AUDIT, [])
  // Tag every audit entry with the active Organization when available.
  // Skip the active-org lookup only for register (called before active
  // Org is written). Subsequent audit writes will see the active org.
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  list.unshift({
    id: newAuditId(),
    at: new Date().toISOString(),
    actorId,
    actorEmail,
    orgId,
    action,
    target,
    serverId,
    details,
  })
  write(KEYS.AUDIT, list)
}

export async function listAudit() {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(80)
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) return []
  assertCan(auth.userId, orgId, 'organization.activity_log.view')
  const all = read(KEYS.AUDIT, [])
  return all.filter((e) => e.orgId === orgId)
}

export async function clearAudit() {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) return
  assertCan(auth.userId, orgId, 'organization.settings.manage')
  const all = read(KEYS.AUDIT, [])
  const next = all.filter((e) => e.orgId !== orgId)
  write(KEYS.AUDIT, next)
}

// --- Server sharing (permission-based) --------------------------------------
//
// Server sharing replaced the role-based "Members with access" flow.
// The Owner is the only one who can grant/revoke per-server access
// (no permission other than ownership opens this UI). Server access
// is stored as a `permissions: string[]` array of composite names
// (`server.<name>.<action>`, `application.<name>.<action>`).
//
// Schema: cp_server_access = [
//   { id, organizationId, serverId, userId, permissions: string[],
//     grantedById, grantedAt }
// ]

// Owner-only check for managing server access rows. Throws if the
// caller is not the org Owner (roleId === null in cp_memberships).
// Permissions like organization.servers.manage do NOT unlock this
// action — it's locked to ownership.
function assertCanManageServerAccess(auth, orgId) {
  if (!auth || !auth.userId) throw new Error('Not signed in')
  if (!orgId) throw new Error('No active organization')
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const me = memberships.find((m) => m.organizationId === orgId && m.userId === auth.userId)
  if (!me) throw new Error('Not a member of this organization')
  if (me.roleId !== null) throw new Error('Only the Org Owner can manage server access')
}

// Email -> user lookup used by the share dialog to validate the
// email the Owner types. Matches case-insensitively and returns a
// public-shaped user record (no password hash). Returns null when no
// account exists so the dialog can show an inline error.
export async function lookupUserByEmail(email) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  const e = (email || '').trim().toLowerCase()
  if (!e) return null
  await delay(40)
  const users = read(KEYS.USERS, [])
  const u = users.find((x) => (x.email || '').toLowerCase() === e)
  return u ? publicUser(u) : null
}

// List of users with explicit access to one server (excludes the
// Owner — they have implicit access and aren't stored in
// cp_server_access). Each row is hydrated with user info so the UI
// can render avatars + names directly.
export async function listSharedUsersForServer(serverId) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  await delay(80)
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  if (!orgId) return []
  const rows = readServerAccessRows().filter((r) => r.serverId === serverId && r.organizationId === orgId)
  const users = read(KEYS.USERS, [])
  return rows.map((r) => ({
    id: r.id,
    serverId: r.serverId,
    userId: r.userId,
    user: publicUser(users.find((u) => u.id === r.userId)),
    permissions: Array.isArray(r.permissions) ? r.permissions.slice() : [],
    grantedById: r.grantedById,
    grantedAt: r.grantedAt,
  })).filter((r) => r.user)
}

// Grant or REPLACE access for one user across one or more servers.
//   payload = { serverIds: string[], userId: string, permissions: string[] }
// Each serverId gets either an upserted row or, if one exists for
// that (serverId, userId), the new permissions[] overwrites the old.
// This is "dialog is truth" — no union, no merge. Validates that
// every permission is server-level or application-level and exists
// in the catalog.
export async function shareServerAccess({ serverIds, userId, permissions }) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  assertCanManageServerAccess(auth, orgId)
  if (!Array.isArray(serverIds) || serverIds.length === 0) throw new Error('Select at least one server')
  if (!userId) throw new Error('User is required')
  if (!Array.isArray(permissions) || permissions.length === 0) throw new Error('Select at least one permission')
  // Validate every permission is server-level or application-level
  // AND exists in the catalog. sanitizePermissions dedupes and walks
  // parents, but we also reject any organization-level perm so a
  // typed bug can't silently grant org-wide access.
  const allowed = permissions.filter((name) =>
    typeof name === 'string' && (name.startsWith('server.') || name.startsWith('application.'))
  )
  if (allowed.length === 0) throw new Error('No valid permissions selected')
  const sanitized = sanitizePermissions(allowed)
  if (sanitized.length === 0) throw new Error('No valid permissions selected')
  const cleanPerms = sanitized.filter((n) =>
    n.startsWith('server.') || n.startsWith('application.')
  )
  if (cleanPerms.length === 0) throw new Error('No valid permissions selected')
  await delay(120)
  const servers = read(KEYS.SERVERS, [])
  for (const serverId of serverIds) {
    if (!servers.some((s) => s.id === serverId && s.orgId === orgId)) {
      throw new Error(`Server ${serverId} not found in this organization`)
    }
  }
  const users = read(KEYS.USERS, [])
  if (!users.some((u) => u.id === userId)) {
    throw new Error('User not found')
  }
  const rows = readServerAccessRows()
  const now = new Date().toISOString()
  for (const serverId of serverIds) {
    const idx = rows.findIndex((r) => r.organizationId === orgId && r.serverId === serverId && r.userId === userId)
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], permissions: cleanPerms, grantedById: auth.userId, grantedAt: now }
    } else {
      rows.push({
        id: newServerAccessId(),
        organizationId: orgId,
        serverId,
        userId,
        permissions: cleanPerms,
        grantedById: auth.userId,
        grantedAt: now,
      })
    }
  }
  write(KEYS.SERVER_ACCESS, rows)
  const actor = users.find((u) => u.id === auth.userId)
  const targetUser = users.find((u) => u.id === userId)
  const actorEmail = actor?.email || 'unknown'
  const userEmail = targetUser?.email || 'unknown user'
  for (const serverId of serverIds) {
    appendAudit({
      actorId: auth.userId,
      actorEmail,
      action: 'server.share.grant',
      target: `server:${serverId}`,
      details: `Granted ${userEmail} ${cleanPerms.length} permissions`,
    })
  }
}

// Revoke explicit access for one user across one or more servers.
// No-op for missing rows.
export async function unshareServerAccess({ serverIds, userId }) {
  const auth = read(KEYS.AUTH, null)
  if (!auth) throw new Error('Not signed in')
  const orgId = readRaw(KEYS.ACTIVE_ORG)
  assertCanManageServerAccess(auth, orgId)
  if (!Array.isArray(serverIds) || serverIds.length === 0) throw new Error('Select at least one server')
  if (!userId) throw new Error('User is required')
  await delay(80)
  const serverIdSet = new Set(serverIds)
  const rows = readServerAccessRows()
  const toRemove = rows.filter((r) => r.organizationId === orgId && r.userId === userId && serverIdSet.has(r.serverId))
  const next = rows.filter((r) => !toRemove.includes(r))
  if (toRemove.length > 0) {
    write(KEYS.SERVER_ACCESS, next)
    const users = read(KEYS.USERS, [])
    const actor = users.find((u) => u.id === auth.userId)
    const targetUser = users.find((u) => u.id === userId)
    const actorEmail = actor?.email || 'unknown'
    const userEmail = targetUser?.email || 'unknown user'
    for (const row of toRemove) {
      appendAudit({
        actorId: auth.userId,
        actorEmail,
        action: 'server.share.revoke',
        target: `server:${row.serverId}`,
        details: `Revoked access for ${userEmail}`,
      })
    }
  }
}

// Called by createServer after the cp_servers row is written.
// Auto-grants access to every Org member whose role grants
// `organization.servers.manage`. Existing rows are overwritten so
// role permission changes update the access set after the next
// server creation (but legacy servers stay untouched — no retroactive
// backfill).
function autoShareNewServerWithManageMembers(orgId, serverId) {
  if (!orgId || !serverId) return
  const memberships = read(KEYS.MEMBERSHIPS, [])
    .filter((m) => m.organizationId === orgId && m.userId && m.roleId)
  const roles = read(KEYS.ROLES, [])
  const eligibleUserIds = []
  for (const m of memberships) {
    const role = roles.find((rl) => rl.id === m.roleId && rl.organizationId === orgId)
    if (!role || !Array.isArray(role.permissions)) continue
    if (role.permissions.includes('organization.servers.manage')) {
      eligibleUserIds.push(m.userId)
    }
  }
  if (eligibleUserIds.length === 0) return
  // Default to "full server+app access" — every server- and
  // application-level permission in the catalog. This matches the
  // prior role-based "Member" default and gives the team something
  // to work with until they edit it down.
  const fullPerms = ALL_PERMISSION_IDS.filter((n) =>
    n.startsWith('server.') || n.startsWith('application.')
  )
  const rows = readServerAccessRows()
  const now = new Date().toISOString()
  for (const userId of eligibleUserIds) {
    const idx = rows.findIndex((r) => r.organizationId === orgId && r.serverId === serverId && r.userId === userId)
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], permissions: fullPerms, grantedById: null, grantedAt: now }
    } else {
      rows.push({
        id: newServerAccessId(),
        organizationId: orgId,
        serverId,
        userId,
        permissions: fullPerms,
        grantedById: null,
        grantedAt: now,
      })
    }
  }
  write(KEYS.SERVER_ACCESS, rows)
}

// --- Init --------------------------------------------------------------------

export function initDemoData() {
  seedIfEmpty()
  backfillOrgIds()
  migrateMembershipsToRoleId()
  migrateRolePermissions()
  migrateRolePermissionsV2()
  backfillMembershipInviteFields()
  migrateServerAccessToPermissions()
}

// Run once when this module is first imported in the browser, so demo
// data seeding and legacy team-name normalization happen for any page
// that touches the API — not only the root `/` page. SSR-safe (no-op
// when `window` is undefined).
if (inBrowser) {
  try {
    seedIfEmpty()
    backfillOrgIds()
    migrateMembershipsToRoleId()
  } catch (_) {
    // never let a localStorage hiccup block module load
  }
}

export const MOCK = MOCK_MODE
export const KEY_HINT_REGEX = KEY_FORMAT