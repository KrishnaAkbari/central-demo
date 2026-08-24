"use client"

// ===========================================================================
// Billing API — mock-only billing state and helpers.
//
// Central Panel is frontend/mock only for now. Every read/write here hits
// localStorage. The shape of the persisted state mirrors what a real
// billing backend would eventually return, so swapping to a real API
// later is a one-file change.
//
// All amounts are USD. Helpers below assume USD formatting. Helpers that
// surface price math (renewal, downgrade, lifetime credit) treat cents
// as integers internally to avoid float drift; display rounds to 2dp.
//
// Personas: see ./billingPersonas.js. Callers should call `seedPersona()`
// (or the persona switcher in /billing) to populate all per-org keys
// with one of the 18 mock scenarios. `getActiveOrgBilling()` returns
// the current state, lazy-seeding a default Free persona if the active
// org has no entry yet.
// ===========================================================================

import {
  read, write, readRaw, writeRaw, KEYS, delay,
} from './centralApi'
import { PERSONAS, getPersonaById, DEFAULT_PERSONA_ID } from './billingPersonas'

// ---------------------------------------------------------------------------
// Plan catalog — Normal (non-restructured) and Restructured structures.
// Prices are USD/month. Server limits are soft (UI surfaces disabled-state
// reasons when an org exceeds them).
//
// Plan ranks (higher = better). Used to enforce no-downgrade rules.
//   Free: 0, Newbie: 1, Legacy: 2, Pro: 3, Master: 4, Business: 5
// ---------------------------------------------------------------------------

export const PLAN_RANKS = {
  free: 0,
  newbie: 1,
  legacy: 2,
  pro: 3,
  master: 4,
  business: 5,
  managed: 1,        // internal rank == Newbie
  self_managed: 5,   // internal rank == Business
}

// Normal (non-restructured) recurring plan catalog.
export const NORMAL_PLANS = [
  {
    id: 'free',
    name: 'Free',
    priceUsd: 0,
    cycle: 'monthly',
    serverLimit: 1,
    features: ['1 server', 'Community support', 'Basic backups'],
    support: 'community',
    badge: 'Free forever',
  },
  {
    id: 'newbie',
    name: 'Newbie',
    priceUsd: 12,
    cycle: 'monthly',
    serverLimit: 5,
    features: ['5 servers', 'Email support', 'Daily backups', 'Standard integrations'],
    support: 'email',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceUsd: 29,
    cycle: 'monthly',
    serverLimit: null, // unlimited
    features: ['Unlimited servers', 'Priority email support', 'Daily backups', 'All integrations'],
    support: 'priority_email',
    popular: true,
  },
  {
    id: 'master',
    name: 'Master',
    priceUsd: 49,
    cycle: 'monthly',
    serverLimit: null,
    features: ['Unlimited servers', 'Priority chat support', 'Hourly backups', 'All integrations'],
    support: 'priority_chat',
  },
  {
    id: 'business',
    name: 'Business',
    priceUsd: 69,
    cycle: 'monthly',
    serverLimit: null,
    features: ['Unlimited servers', '24/7 chat support', 'Hourly backups', 'White-glove onboarding'],
    support: '247_chat',
  },
]

// Restructured recurring plan catalog. Display names: Newbie -> "Managed",
// Business -> "Self Managed". Internal ids stay as `managed` and
// `self_managed`. Free is part of restructured too but visibility rules
// (Free only when current sub is Free) apply regardless of structure.
export const RESTRUCTURED_PLANS = [
  {
    id: 'managed',
    name: 'Managed',
    priceUsd: 12,
    cycle: 'monthly',
    serverLimit: 5,
    features: ['5 servers', 'ServerAvatar-managed infrastructure', 'Email support', 'Daily backups'],
    support: 'email',
    internalTier: 'newbie',
  },
  {
    id: 'self_managed',
    name: 'Self Managed',
    priceUsd: 69,
    cycle: 'monthly',
    serverLimit: null,
    features: ['Unlimited servers', 'You run your own infra', 'Priority chat support', 'Hourly backups'],
    support: 'priority_chat',
    internalTier: 'business',
    popular: true,
  },
]

// Legacy / grandfathered plan entry — surfaced only when current sub is
// Legacy. Price comes from billingState.legacyInfo.
export const LEGACY_PLAN = {
  id: 'legacy',
  name: 'Legacy',
  priceUsd: 0,         // overridden at render from legacyInfo.originalPriceUsd
  cycle: 'monthly',
  serverLimit: null,   // overridden at render from legacyInfo
  features: ['Legacy plan features', 'Locked-in original pricing'],
  support: 'community',
  rank: 2,
}

// Enterprise plan removed entirely per spec (2026-07-14).

// Lifetime catalog — separate from recurring.
export const TRADITIONAL_LIFETIME = [
  { id: 'lifetime_newbie',   name: 'Newbie Lifetime',   priceUsd: 499,  serverLimit: 5,    extraSlotPriceUsd: 24,  features: ['5 servers forever', 'One-time payment', 'Daily backups'] },
  { id: 'lifetime_pro',      name: 'Pro Lifetime',      priceUsd: 1299, serverLimit: 25,   extraSlotPriceUsd: 35,  features: ['25 servers forever', 'One-time payment', 'Hourly backups'] },
  { id: 'lifetime_master',   name: 'Master Lifetime',   priceUsd: 1699, serverLimit: 75,   extraSlotPriceUsd: null, features: ['75 servers forever', 'One-time payment', 'Hourly backups'] },
  { id: 'lifetime_business', name: 'Business Lifetime', priceUsd: 2299, serverLimit: null, extraSlotPriceUsd: null, topTier: true, features: ['Unlimited servers forever', 'One-time payment', 'Hourly backups', '24/7 support'] },
]

export const RESTRUCTURED_LIFETIME = [
  // Restructured lifetime focuses on the top tier — Self Managed / Business.
  { id: 'lifetime_business', name: 'Self Managed Lifetime', priceUsd: 2299, serverLimit: null, topTier: true, features: ['Unlimited servers forever', 'One-time payment', 'Hourly backups', '24/7 support'] },
]

// ---------------------------------------------------------------------------
// Feature matrix — single source of truth for the side-by-side plan
// comparison view. PlanMatrix.jsx reads from this and renders a table.
//
// Each row is one feature. Each plan's cell value comes from
// `PLAN_MATRIX_VALUES[plan.id]`. Plans not in the lookup get a dash.
//
// Categories group related rows so users can scan by domain. Categories
// with no visible plans covering any of their features collapse.
//
// Feature `kind`s:
//   - 'value' : free-form string (e.g. "5", "Unlimited", "Hourly")
//   - 'bool'  : boolean → checkmark or dash
//   - 'price' : number → "$X/mo each" or "Included"
// ---------------------------------------------------------------------------
export const FEATURE_MATRIX = [
  {
    category: 'Servers',
    rows: [
      { id: 'servers',        label: 'Server limit',           kind: 'value' },
      { id: 'extra_slot',     label: 'Extra server slot',      kind: 'price' },
    ],
  },
  {
    category: 'Backups',
    rows: [
      { id: 'backup_freq',    label: 'Backup frequency',       kind: 'value' },
      { id: 'backup_retention', label: 'Backup retention',     kind: 'value' },
    ],
  },
  {
    category: 'Support',
    rows: [
      { id: 'support_tier',   label: 'Support tier',           kind: 'value' },
      { id: 'response_time',  label: 'Response time',          kind: 'value' },
    ],
  },
  {
    category: 'Integrations',
    rows: [
      { id: 'standard_integ', label: 'Standard integrations',  kind: 'bool' },
      { id: 'all_integ',      label: 'All integrations',       kind: 'bool' },
      { id: 'api',            label: 'API access',             kind: 'bool' },
    ],
  },
  {
    category: 'Onboarding',
    rows: [
      { id: 'white_glove',    label: 'White-glove onboarding', kind: 'bool' },
    ],
  },
]

// Default values per plan id. Missing plan ids fall through to a dash.
// `extra_slot` uses cents-as-integer math via the same pattern as
// elsewhere (raw price in dollars, formatter formats).
export const PLAN_MATRIX_VALUES = {
  free: {
    servers: '1',
    extra_slot: 0, // 0 → "—"
    backup_freq: 'Daily',
    backup_retention: '7 days',
    support_tier: 'Community',
    response_time: 'Best effort',
    standard_integ: false,
    all_integ: false,
    api: false,
    white_glove: false,
  },
  newbie: {
    servers: '5',
    extra_slot: 24,
    backup_freq: 'Daily',
    backup_retention: '30 days',
    support_tier: 'Email',
    response_time: '48 hours',
    standard_integ: true,
    all_integ: false,
    api: false,
    white_glove: false,
  },
  pro: {
    servers: 'Unlimited',
    extra_slot: 24,
    backup_freq: 'Daily',
    backup_retention: '30 days',
    support_tier: 'Priority email',
    response_time: '24 hours',
    standard_integ: true,
    all_integ: true,
    api: true,
    white_glove: false,
  },
  master: {
    servers: 'Unlimited',
    extra_slot: 0,
    backup_freq: 'Hourly',
    backup_retention: '90 days',
    support_tier: 'Priority chat',
    response_time: '8 hours',
    standard_integ: true,
    all_integ: true,
    api: true,
    white_glove: false,
  },
  business: {
    servers: 'Unlimited',
    extra_slot: 0,
    backup_freq: 'Hourly',
    backup_retention: '180 days',
    support_tier: '24/7 chat',
    response_time: '1 hour',
    standard_integ: true,
    all_integ: true,
    api: true,
    white_glove: true,
  },
  // Restructured tiers — same numeric values as their normal counterparts,
  // but display name comes from the restructured plan card.
  managed: {
    servers: '5',
    extra_slot: 24,
    backup_freq: 'Daily',
    backup_retention: '30 days',
    support_tier: 'Email',
    response_time: '48 hours',
    standard_integ: true,
    all_integ: false,
    api: false,
    white_glove: false,
  },
  self_managed: {
    servers: 'Unlimited',
    extra_slot: 0,
    backup_freq: 'Hourly',
    backup_retention: '180 days',
    support_tier: '24/7 chat',
    response_time: '1 hour',
    standard_integ: true,
    all_integ: true,
    api: true,
    white_glove: true,
  },
}

// Legacy plans don't have a fixed matrix — their values come from
// legacyInfo. PlanMatrix.jsx ignores PLAN_MATRIX_VALUES for legacy and
// renders "—" for everything except server limit + support tier (which
// are filled from legacyInfo).

// Trial config. 7-day trial for new registered users per spec.
export const TRIAL_DURATION_DAYS = 7
export const TRIAL_EXPIRY_SOON_DAYS = 2

// ---------------------------------------------------------------------------
// Cancellation impact — diffs the user's current plan vs Free and
// returns a structured "what you'll lose" payload for CancelPlanDialog.
// Categories with no actual changes collapse out of the rendered list.
// ---------------------------------------------------------------------------

const REASON_OPTIONS = [
  { id: 'too_expensive',  label: 'Too expensive' },
  { id: 'not_using',      label: 'Not using enough' },
  { id: 'switching',      label: 'Switching providers' },
  { id: 'missing',        label: 'Missing features' },
  { id: 'temporary',      label: 'Temporary — will come back' },
  { id: 'other',          label: 'Other' },
]

export function getCancellationReasons() {
  return REASON_OPTIONS
}

export function getCancellationImpact(state, plan, serverCount = 0, walletBalance = 0) {
  if (!state || !plan) return null

  // Legacy users: no plan-matrix diff available. Show generic fallback.
  const isLegacy = state.legacyInfo != null
  if (isLegacy) {
    return {
      isLegacy: true,
      planName: plan.name,
      planPriceUsd: plan.priceUsd,
      periodEnd: state.currentPeriodEnd,
      categories: [],
      serverOverhang: 0,
      walletBalance: Number(walletBalance) || 0,
    }
  }

  const curId = state.planTier
  const curValues = PLAN_MATRIX_VALUES[curId] || null
  const freeValues = PLAN_MATRIX_VALUES.free || null
  if (!curValues || !freeValues) return null

  // Build the diff: walk FEATURE_MATRIX categories and only keep rows
  // where the current value differs from free.
  const categories = []
  for (const cat of FEATURE_MATRIX) {
    const changes = []
    for (const row of cat.rows) {
      const cur = curValues[row.id]
      const free = freeValues[row.id]
      // Normalize booleans and strings for comparison.
      const same = cur === free ||
        (typeof cur === 'boolean' && typeof free === 'boolean' && cur === free) ||
        (String(cur) === String(free))
      if (same) continue
      changes.push({
        rowId: row.id,
        label: row.label,
        kind: row.kind,
        current: cur,
        after: free,
      })
    }
    if (changes.length > 0) {
      categories.push({ category: cat.category, changes })
    }
  }

  // Server overhang: how many servers will exceed Free's 1-server cap.
  const freeServerCap = 1
  const overhang = Math.max(0, (serverCount || 0) - freeServerCap)

  return {
    isLegacy: false,
    planName: plan.name,
    planPriceUsd: plan.priceUsd,
    periodEnd: state.currentPeriodEnd,
    categories,
    serverOverhang: overhang,
    walletBalance: Number(walletBalance) || 0,
  }
}

// ---------------------------------------------------------------------------
// Plan-switch diff — compares two plans across the feature matrix and
// returns a categorized list of gains, losses, and price changes for the
// "What changes if I switch?" preview on plan cards (round 6).
//
// Returns:
//   {
//     fromTier, toTier,
//     fromPriceUsd, toPriceUsd,
//     priceDeltaUsd,             // signed; positive = paying more
//     priceDeltaPct,             // signed
//     categories: [{category, rows: [{rowId, label, kind, from, to}]}],
//     gainsCount, lossesCount,   // convenience counters for the teaser line
//   }
//
// Categories only include rows where the value actually changes. The UI
// colors rows: green for a value getting better (e.g. Unlimited vs 5
// servers), red for getting worse. "Better"/"worse" is per-row:
//   - servers/extra_slot/backup_retention: higher is better (null/unlimited > n)
//   - response_time: lower is better ("1 hour" beats "48 hours")
//   - *_integ / api / white_glove: false→true is a gain, true→false a loss
//   - support_tier / backup_freq: directional (more featured = gain)
//
// Falls back gracefully if either tier is unknown to PLAN_MATRIX_VALUES.
// ---------------------------------------------------------------------------
export function getPlanSwitchDiff(fromTier, toTier) {
  const fromVals = (fromTier && PLAN_MATRIX_VALUES[fromTier]) || null
  const toVals = (toTier && PLAN_MATRIX_VALUES[toTier]) || null
  const fromPrice = findPlanPriceUsd(fromTier)
  const toPrice = findPlanPriceUsd(toTier)

  // Price delta: signed; positive = paying more after the switch.
  const priceDeltaUsd = (toPrice ?? 0) - (fromPrice ?? 0)
  const priceDeltaPct = fromPrice > 0
    ? Math.round((priceDeltaUsd / fromPrice) * 100)
    : null

  // Categorize each row across FEATURE_MATRIX as gain / loss / unchanged.
  const categories = []
  let gainsCount = 0
  let lossesCount = 0
  if (fromVals && toVals) {
    for (const cat of FEATURE_MATRIX) {
      const rows = []
      for (const row of cat.rows) {
        const fv = fromVals[row.id]
        const tv = toVals[row.id]
        if (valuesEqual(fv, tv)) continue
        const dir = directionOf(row, fv, tv) // 'gain' | 'loss'
        if (dir === 'gain') gainsCount += 1
        else lossesCount += 1
        rows.push({ rowId: row.id, label: row.label, kind: row.kind, from: fv, to: tv, direction: dir })
      }
      if (rows.length > 0) categories.push({ category: cat.category, rows })
    }
  }

  return {
    fromTier, toTier,
    fromPriceUsd: fromPrice ?? 0,
    toPriceUsd: toPrice ?? 0,
    priceDeltaUsd,
    priceDeltaPct,
    categories,
    gainsCount,
    lossesCount,
  }
}

function valuesEqual(a, b) {
  if (a === b) return true
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b)
  return String(a) === String(b)
}

// Per-row direction: 'gain' if `to` is strictly better than `from`,
// 'loss' otherwise. Returns 'neutral' if direction is ambiguous
// (e.g. support tier values that are just different words).
function directionOf(row, from, to) {
  switch (row.id) {
    case 'servers':
    case 'extra_slot':
    case 'backup_retention':
      // numeric or string like 'Unlimited' / '30 days' — higher is better
      return toValueScore(row.id, to) > toValueScore(row.id, from) ? 'gain' : 'loss'
    case 'response_time':
      // '1 hour' < '8 hours' < '24 hours' < '48 hours' < 'Best effort' — lower is better
      return toValueScore(row.id, to) < toValueScore(row.id, from) ? 'gain' : 'loss'
    case 'backup_freq':
      // 'Hourly' > 'Daily' > 'Best effort' — higher freq is better
      return toValueScore(row.id, to) > toValueScore(row.id, from) ? 'gain' : 'loss'
    case 'support_tier':
      // Tier ladder: Community < Email < Priority email < Priority chat < 24/7 chat < Dedicated
      return toValueScore(row.id, to) > toValueScore(row.id, from) ? 'gain' : 'loss'
    case 'standard_integ':
    case 'all_integ':
    case 'api':
    case 'white_glove':
      return Boolean(to) && !Boolean(from) ? 'gain' : (Boolean(from) && !Boolean(to) ? 'loss' : 'neutral')
    default:
      return 'neutral'
  }
}

function toValueScore(rowId, val) {
  if (val == null) return -1
  switch (rowId) {
    case 'servers': {
      if (typeof val === 'string') {
        if (/unlimited/i.test(val)) return 1e9
        const n = parseInt(val, 10)
        return Number.isFinite(n) ? n : 0
      }
      return Number(val) || 0
    }
    case 'extra_slot':
      // 0 means "not available" (rendered as "—"). Treat 0 as worst.
      if (!val) return -1
      return Number(val) || 0
    case 'backup_retention': {
      if (typeof val === 'string') {
        const m = val.match(/(\d+)\s*(day|month|year)/i)
        if (!m) return 0
        const n = parseInt(m[1], 10)
        const unit = m[2].toLowerCase()
        return unit.startsWith('year') ? n * 365 : unit.startsWith('month') ? n * 30 : n
      }
      return 0
    }
    case 'response_time': {
      if (typeof val === 'string') {
        const lower = val.toLowerCase()
        if (lower.includes('best effort')) return 1e9
        const m = lower.match(/(\d+)\s*(hour|minute|day)/)
        if (!m) return 0
        const n = parseInt(m[1], 10)
        const unit = m[2]
        return unit.startsWith('day') ? n * 24 : unit.startsWith('minute') ? Math.max(1, n / 60) : n
      }
      return 0
    }
    case 'backup_freq': {
      const v = String(val).toLowerCase()
      if (v.includes('hour')) return 4
      if (v.includes('daily')) return 3
      if (v.includes('weekly')) return 2
      if (v.includes('best effort')) return 1
      return 0
    }
    case 'support_tier': {
      const v = String(val).toLowerCase()
      if (v.includes('dedicated')) return 6
      if (v.includes('24/7')) return 5
      if (v.includes('priority chat')) return 4
      if (v.includes('priority email')) return 3
      if (v.includes('email')) return 2
      if (v.includes('community')) return 1
      return 0
    }
    default:
      return 0
  }
}

function findPlanPriceUsd(tier) {
  if (!tier) return null
  const fromNormal = NORMAL_PLANS.find((p) => p.id === tier)
  if (fromNormal) return fromNormal.priceUsd
  const fromRestructured = RESTRUCTURED_PLANS.find((p) => p.id === tier)
  if (fromRestructured) return fromRestructured.priceUsd
  return null
}

// ---------------------------------------------------------------------------
// Helpers — server counts (UI uses these to decide disabled-plan reasons).
// ---------------------------------------------------------------------------

export function getActiveOrgId() {
  return readRaw(KEYS.ACTIVE_ORG)
}

// ---------------------------------------------------------------------------
// Multi-org billing aggregation.
//
// Returns a view-model summarizing billing across every organization the
// signed-in user belongs to. Used by MultiOrgBillingSummary component on
// the Overview page so users with multiple orgs see one combined view
// instead of having to flip between orgs to check each plan.
//
// Per-org rows include: org name, plan name, status (active / trial /
// canceled / lifetime / expired / free), next renewal date (or null),
// monthly price, server count, wallet balance, and the over-limit flag
// derived from plan.serverLimit.
//
// Aggregate footer includes: total monthly cost, total wallet balance,
// total server count, count of orgs nearing or past server limits, and
// the soonest next-renewal date across all paid orgs.
//
// The current active org is marked so the UI can highlight it.
//
// Demo-grade: reads from localStorage like everything else here. Returns
// an empty list when the user has no memberships (defensive).
// ---------------------------------------------------------------------------
export function getMultiOrgBillingSummary() {
  const auth = read(KEYS.AUTH, null)
  const memberships = read(KEYS.MEMBERSHIPS, [])
  const orgs = read(KEYS.ORGANIZATIONS, [])
  const servers = read(KEYS.SERVERS, [])
  const walletMap = read(KEYS.WALLET, {})
  const billingMap = read(KEYS.BILLING, {})

  if (!auth) return { orgs: [], activeOrgId: null, totals: null }

  const userOrgIds = memberships
    .filter((m) => m.userId === auth.userId)
    .map((m) => m.organizationId)
  const userSet = new Set(userOrgIds)
  const visibleOrgs = orgs.filter((o) => userSet.has(o.id))
  const activeOrgId = readRaw(KEYS.ACTIVE_ORG)

  const rows = visibleOrgs.map((org) => {
    const state = billingMap[org.id] || null
    const plan = (() => {
      if (!state) return null
      if (state.status === 'lifetime_active' && state.lifetimeTier) {
        return findLifetimeById(state.lifetimeTier)
      }
      if (state.legacyInfo) {
        return {
          ...LEGACY_PLAN,
          name: state.legacyInfo.name || 'Legacy',
          priceUsd: state.legacyInfo.originalPriceUsd ?? 0,
        }
      }
      const catalog = state.planStructure === 'restructured' ? RESTRUCTURED_PLANS : NORMAL_PLANS
      return catalog.find((p) => p.id === state.planTier) || null
    })()
    const wallet = walletMap[org.id] || { balance: 0, currency: 'USD' }
    const serverCount = servers.filter((s) => s.orgId === org.id && s.status !== 'archived').length
    const serverLimit = plan?.serverLimit ?? null

    // Status label / tone — mirrors Overview's vocabulary so users see
    // the same words in the same place.
    let status = 'active'
    let statusLabel = 'Active'
    let statusTone = 'success'
    let monthlyPriceUsd = plan?.priceUsd ?? 0

    if (!state || state.status === 'none') {
      status = 'free'
      statusLabel = 'Free'
      statusTone = 'neutral'
      monthlyPriceUsd = 0
    } else if (state.status === 'lifetime_active') {
      status = 'lifetime'
      statusLabel = 'Lifetime'
      statusTone = 'success'
      monthlyPriceUsd = 0 // one-time, not a recurring monthly charge
    } else if (state.trialState === 'trial_active') {
      status = 'trial'
      statusLabel = 'Trial'
      statusTone = 'info'
      monthlyPriceUsd = 0
    } else if (state.trialState === 'trial_expired') {
      status = 'expired'
      statusLabel = 'Trial expired'
      statusTone = 'warning'
      monthlyPriceUsd = 0
    } else if (state.status === 'canceled') {
      status = 'canceled'
      statusLabel = 'Canceled'
      statusTone = 'warning'
      monthlyPriceUsd = 0
    } else if (state.status === 'active') {
      status = 'active'
      statusLabel = 'Active'
      statusTone = 'success'
    }

    const overLimit = serverLimit != null && serverCount > serverLimit
    const approachingLimit = !overLimit && serverLimit != null && (serverCount / serverLimit) >= 0.7

    return {
      orgId: org.id,
      orgName: org.name || 'Organization',
      planId: plan?.id || state?.planTier || 'free',
      planName: plan?.name || (state?.planTier === 'free' ? 'Free' : 'Unknown'),
      status,
      statusLabel,
      statusTone,
      monthlyPriceUsd,
      nextRenewalAt: state?.currentPeriodEnd || null,
      serverCount,
      serverLimit,
      overLimit,
      approachingLimit,
      walletBalance: Number(wallet.balance) || 0,
      isActive: org.id === activeOrgId,
    }
  })

  // Aggregate totals. Wallet sums across every org (credit is
  // org-scoped but users think of it as one balance to spend).
  const totals = rows.reduce(
    (acc, r) => {
      acc.monthlyUsd += r.monthlyPriceUsd
      acc.walletUsd += r.walletBalance
      acc.servers += r.serverCount
      acc.overLimitCount += r.overLimit ? 1 : 0
      acc.approachingLimitCount += r.approachingLimit ? 1 : 0
      return acc
    },
    { monthlyUsd: 0, walletUsd: 0, servers: 0, overLimitCount: 0, approachingLimitCount: 0 }
  )

  // Soonest renewal date across paid, active orgs. null if none.
  const renewals = rows
    .filter((r) => r.status === 'active' && r.monthlyPriceUsd > 0 && r.nextRenewalAt)
    .map((r) => new Date(r.nextRenewalAt).getTime())
  totals.nextRenewalAt = renewals.length
    ? new Date(Math.min(...renewals)).toISOString()
    : null

  return { orgs: rows, activeOrgId, totals }
}

export function countActiveServers() {
  const orgId = getActiveOrgId()
  if (!orgId) return 0
  const servers = read(KEYS.SERVERS, [])
  return servers.filter((s) => s.orgId === orgId && s.status !== 'archived').length
}

export function getPlanForOrg(orgId) {
  const state = getBillingStateForOrg(orgId)
  if (!state) return null
  if (state.status === 'lifetime_active' && state.lifetimeTier) {
    return findLifetimeById(state.lifetimeTier)
  }
  if (state.legacyInfo) {
    // Build a Legacy plan object from current legacyInfo.
    return {
      ...LEGACY_PLAN,
      name: state.legacyInfo.name || 'Legacy',
      priceUsd: state.legacyInfo.originalPriceUsd ?? 0,
    }
  }
  const catalog = state.planStructure === 'restructured' ? RESTRUCTURED_PLANS : NORMAL_PLANS
  return catalog.find((p) => p.id === state.planTier) || null
}

function findLifetimeById(id) {
  return [...TRADITIONAL_LIFETIME, ...RESTRUCTURED_LIFETIME].find((p) => p.id === id)
}

// ---------------------------------------------------------------------------
// State access
// ---------------------------------------------------------------------------

export function getBillingStateForOrg(orgId) {
  if (!orgId) return null
  const map = read(KEYS.BILLING, {})
  return map[orgId] || null
}

export function getActiveOrgBilling() {
  const orgId = getActiveOrgId()
  if (!orgId) return null
  let state = getBillingStateForOrg(orgId)
  if (!state) {
    // Lazy-seed: new active org gets the default normal recurring user.
    state = seedPersonaForOrg(orgId, DEFAULT_PERSONA_ID)
  }
  return state
}

export function setBillingStateForOrg(orgId, partial) {
  if (!orgId) return null
  const map = read(KEYS.BILLING, {})
  const current = map[orgId] || {}
  const next = { ...current, ...partial, updatedAt: new Date().toISOString() }
  map[orgId] = next
  write(KEYS.BILLING, map)
  return next
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export function getWallet(orgId) {
  const id = orgId || getActiveOrgId()
  if (!id) return { balance: 0, currency: 'USD' }
  const map = read(KEYS.WALLET, {})
  return map[id] || { balance: 0, currency: 'USD' }
}

export function setWalletBalance(orgId, balance) {
  const id = orgId || getActiveOrgId()
  if (!id) return
  const map = read(KEYS.WALLET, {})
  const cur = map[id] || { balance: 0, currency: 'USD' }
  map[id] = { ...cur, balance: Math.max(0, Math.round(balance * 100) / 100) }
  write(KEYS.WALLET, map)
}

export function debitWallet(orgId, amount) {
  const w = getWallet(orgId)
  if (w.balance < amount) return { ok: false, reason: 'insufficient_balance', balance: w.balance }
  setWalletBalance(orgId, w.balance - amount)
  return { ok: true, balance: w.balance - amount }
}

// ---------------------------------------------------------------------------
// Transactions — append-only mock history.
// ---------------------------------------------------------------------------

let _txSeq = 0
function nextTxId() {
  _txSeq += 1
  return `tx_${Date.now()}_${_txSeq}`
}

export function getTransactions(orgId) {
  const id = orgId || getActiveOrgId()
  if (!id) return []
  const map = read(KEYS.TRANSACTIONS, {})
  return map[id] || []
}

export function appendTransaction(orgId, tx) {
  const id = orgId || getActiveOrgId()
  if (!id) return null
  const map = read(KEYS.TRANSACTIONS, {})
  const list = map[id] || []
  const row = {
    id: nextTxId(),
    createdAt: new Date().toISOString(),
    status: 'completed',
    ...tx,
  }
  list.unshift(row) // newest first
  map[id] = list
  write(KEYS.TRANSACTIONS, map)
  return row
}

// ---------------------------------------------------------------------------
// Billing details + auto recharge
// ---------------------------------------------------------------------------

export const DEFAULT_BILLING_DETAILS = {
  name: '',
  company: '',
  email: '',
  address: '',
  country: '',
  taxId: '',
}

export function getBillingDetails(orgId) {
  const id = orgId || getActiveOrgId()
  if (!id) return DEFAULT_BILLING_DETAILS
  const map = read(KEYS.BILLING_DETAILS, {})
  return map[id] || DEFAULT_BILLING_DETAILS
}

export function saveBillingDetails(orgId, details) {
  const id = orgId || getActiveOrgId()
  if (!id) return
  const map = read(KEYS.BILLING_DETAILS, {})
  map[id] = { ...DEFAULT_BILLING_DETAILS, ...details, savedAt: new Date().toISOString() }
  write(KEYS.BILLING_DETAILS, map)
}

export const DEFAULT_AUTO_RECHARGE = {
  enabled: false,
  thresholdUsd: 10,
  rechargeAmountUsd: 25,
  paymentMethod: 'card_placeholder',
}

export function getAutoRecharge(orgId) {
  const id = orgId || getActiveOrgId()
  if (!id) return DEFAULT_AUTO_RECHARGE
  const map = read(KEYS.AUTO_RECHARGE, {})
  return map[id] || DEFAULT_AUTO_RECHARGE
}

export function saveAutoRecharge(orgId, settings) {
  const id = orgId || getActiveOrgId()
  if (!id) return
  const map = read(KEYS.AUTO_RECHARGE, {})
  map[id] = { ...DEFAULT_AUTO_RECHARGE, ...settings, savedAt: new Date().toISOString() }
  write(KEYS.AUTO_RECHARGE, map)
}

// ---------------------------------------------------------------------------
// Persona seeding — wipes existing billing/wallet/transactions for org and
// reapplies one of the 18 mock personas from billingPersonas.js.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Event dispatch — emit a 'billing:state-changed' event so subscribers
// (TrialStickyBar in /billing layout, persona switchers, future reactive
// UI) can refresh themselves after any billing mutation.
// ---------------------------------------------------------------------------
function emitStateChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('billing:state-changed'))
  }
}

export function seedPersonaForOrg(orgId, personaId) {
  const persona = getPersonaById(personaId) || PERSONAS[0]
  const now = new Date()
  const isoOffset = (days) => new Date(now.getTime() + days * 86400000).toISOString()

  const state = persona.buildBillingState({ now, isoOffset })

  // Persist
  const billMap = read(KEYS.BILLING, {})
  billMap[orgId] = state
  write(KEYS.BILLING, billMap)

  const walletMap = read(KEYS.WALLET, {})
  walletMap[orgId] = persona.wallet
  write(KEYS.WALLET, walletMap)

  const txMap = read(KEYS.TRANSACTIONS, {})
  txMap[orgId] = persona.transactions.map((t) => ({
    id: nextTxId(),
    createdAt: t.createdAt || now.toISOString(),
    status: 'completed',
    ...t,
  }))
  write(KEYS.TRANSACTIONS, txMap)

  const arMap = read(KEYS.AUTO_RECHARGE, {})
  arMap[orgId] = persona.autoRecharge
  write(KEYS.AUTO_RECHARGE, arMap)

  const bdMap = read(KEYS.BILLING_DETAILS, {})
  bdMap[orgId] = persona.billingDetails
  write(KEYS.BILLING_DETAILS, bdMap)

  // Payment methods are optional per-persona. Personas without a
  // paymentMethods field get an empty list — the page shows the empty
  // state and the user adds the first card manually.
  const pmMap = read(KEYS.PAYMENT_METHODS, {})
  pmMap[orgId] = persona.paymentMethods || { items: [], defaultId: null }
  write(KEYS.PAYMENT_METHODS, pmMap)

  emitStateChanged()
  return state
}

export function seedPersona(personaId) {
  const orgId = getActiveOrgId()
  if (!orgId) return null
  // Persist persona selection so the switcher remembers
  writeRaw(KEYS.BILLING_PERSONA, personaId)
  const result = seedPersonaForOrg(orgId, personaId)
  // Persona-specific side effects that aren't pure billing state.
  // For non_owner_member, flip the active membership roleId so the
  // UI treats the viewer as a non-owner (drives RestrictedAccess gate).
  // The side effect is symmetric: switching AWAY from non_owner_member
  // restores the roleId to null so the owner-only pages recover. Without
  // this, picking any other persona while in non_owner_member mode
  // leaves the user permanently locked out — the dropdown is also
  // gated behind RestrictedAccess, so the user can't escape.
  const authRaw = readRaw(KEYS.AUTH)
  const userId = authRaw ? (() => { try { return JSON.parse(authRaw).userId } catch { return null } })() : null
  if (userId) {
    const mems = read(KEYS.MEMBERSHIPS, [])
    const idx = mems.findIndex(
      (m) => m.organizationId === orgId && m.userId === userId,
    )
    if (idx >= 0) {
      if (personaId === 'non_owner_member') {
        const adminRole = (read(KEYS.ROLES, []) || []).find((r) => r.name === 'admin')
        if (adminRole) {
          mems[idx] = { ...mems[idx], roleId: adminRole.id, role: 'member' }
          write(KEYS.MEMBERSHIPS, mems)
        }
      } else {
        // Any other persona — restore to owner (roleId null). Only
        // touches the row if it's currently a non-owner row; leaves
        // real org members alone.
        const wasMember = mems[idx].roleId !== null
        if (wasMember && mems[idx].role === 'member') {
          mems[idx] = { ...mems[idx], roleId: null, role: null }
          write(KEYS.MEMBERSHIPS, mems)
        }
      }
    }
  }
  return result
}

export function getSelectedPersonaId() {
  return readRaw(KEYS.BILLING_PERSONA) || DEFAULT_PERSONA_ID
}

// ---------------------------------------------------------------------------
// Plan visibility — single source of truth for which plans to render.
// The full normal catalog is Newbie/Pro/Master/Business. Free and Legacy
// are conditional: Free only when current subscription.name === 'Free',
// Legacy only when current subscription.name === 'Legacy'. For
// restructured users, only Managed and Self Managed show; never Newbie,
// Pro, Master, Legacy. Free still follows the Free rule.
// ---------------------------------------------------------------------------
export function getCurrentPlanId(state) {
  if (!state) return null
  if (state.legacyInfo) return 'legacy'
  return state.planTier || null
}

export function getVisibleRecurringPlans(state) {
  if (!state) return []
  const isRestructured = !!state.usesRestructuredTier
  const onLifetime = state.status === 'lifetime_active' && state.lifetimeTier
  if (onLifetime) return [] // lifetime users don't see recurring picker
  if (isRestructured) {
    return RESTRUCTURED_PLANS.slice() // managed, self_managed
  }
  // Normal user: Newbie/Pro/Master/Business
  const visible = NORMAL_PLANS.filter((p) => ['newbie', 'pro', 'master', 'business'].includes(p.id))
  // Free visible only when current sub is Free
  if (state.planTier === 'free') {
    visible.unshift(NORMAL_PLANS.find((p) => p.id === 'free'))
  }
  // Legacy visible only when current sub is Legacy — card is built from
  // the actual subscription data (legacyInfo), not hardcoded.
  if (state.legacyInfo) {
    const legacy = {
      ...LEGACY_PLAN,
      name: state.legacyInfo.name || 'Legacy',
      priceUsd: state.legacyInfo.originalPriceUsd ?? 0,
      features: [
        'Locked-in legacy pricing',
        `Original plan: ${state.legacyInfo.originalPlanId || 'unknown'}`,
        state.legacyInfo.grantedAt
          ? `Granted ${new Date(state.legacyInfo.grantedAt).toLocaleDateString()}`
          : 'Grandfathered plan',
      ],
    }
    visible.unshift(legacy)
  }
  return visible
}

// ---------------------------------------------------------------------------
// Mutations — checkout, cancel, resume, start trial.
// All return the updated billing state.
// ---------------------------------------------------------------------------

export function startTrial() {
  const orgId = getActiveOrgId()
  if (!orgId) return null
  const cur = getBillingStateForOrg(orgId)
  if (!cur || cur.trialState !== 'trial_eligible') return cur
  const expiresAt = new Date(Date.now() + TRIAL_DURATION_DAYS * 86400000).toISOString()
  const next = setBillingStateForOrg(orgId, {
    status: 'trial_active',
    trialState: 'trial_active',
    trialStartedAt: new Date().toISOString(),
    trialExpiresAt: expiresAt,
    trialInternalTier: cur.usesRestructuredTier ? 'business' : 'newbie',
    planStructure: cur.usesRestructuredTier ? 'restructured' : 'traditional',
  })
  appendTransaction(orgId, {
    type: 'trial_start',
    amount: 0,
    description: cur.usesRestructuredTier ? 'Self Managed Trial started' : 'Newbie Trial started',
  })
  emitStateChanged()
  return next
}

export function cancelRecurring() {
  const orgId = getActiveOrgId()
  if (!orgId) return null
  const cur = getBillingStateForOrg(orgId)
  if (!cur) return null
  if (cur.status !== 'active' || cur.lifetimeTier) return cur
  const next = setBillingStateForOrg(orgId, {
    status: 'canceled',
    canceledAt: new Date().toISOString(),
  })
  emitStateChanged()
  return next
}

export function resumeRecurring() {
  const orgId = getActiveOrgId()
  if (!orgId) return null
  const cur = getBillingStateForOrg(orgId)
  if (!cur || cur.status !== 'canceled') return cur
  const next = setBillingStateForOrg(orgId, {
    status: 'active',
    canceledAt: null,
  })
  emitStateChanged()
  return next
}

export function checkoutRecurring({ planId, useWallet = true }) {
  const orgId = getActiveOrgId()
  if (!orgId) return { ok: false, reason: 'no_org' }
  const cur = getBillingStateForOrg(orgId)
  if (!cur) return { ok: false, reason: 'no_state' }
  // Enforce visibility: cannot checkout a plan not in the visible catalog.
  const visible = getVisibleRecurringPlans(cur)
  const plan = visible.find((p) => p.id === planId)
  if (!plan) return { ok: false, reason: 'unknown_plan' }
  if (plan.contactSales) return { ok: false, reason: 'contact_sales' }

  // Rank-based no-downgrade was removed in round 7 so users can move
  // down through the picker and see the impact preview before
  // confirming. A real backend would also need proration and refund
  // logic here — out of scope for the mock-only billing API.
  const curTier = getCurrentPlanId(cur)
  const curRank = PLAN_RANKS[curTier] ?? 0
  const newRank = PLAN_RANKS[planId] ?? 0

  const price = plan.priceUsd
  let amountDue = price
  let walletApplied = 0
  if (useWallet && price > 0) {
    const w = getWallet(orgId)
    walletApplied = Math.min(w.balance, price)
    amountDue = Math.max(0, price - walletApplied)
  }

  if (walletApplied > 0) debitWallet(orgId, walletApplied)
  appendTransaction(orgId, {
    type: amountDue === 0 ? 'wallet_debit' : 'plan_renewal',
    amount: price,
    description: `${plan.name} — ${cur.usesRestructuredTier ? 'Restructured' : 'Normal'}`,
    walletApplied,
    amountDue,
    planId,
  })

  setBillingStateForOrg(orgId, {
    status: 'active',
    planTier: plan.id,
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
    canceledAt: null,
    trialState: cur.trialState === 'trial_active' ? 'trial_converted' : cur.trialState,
    trialExpiresAt: null,
  })
  emitStateChanged()
  return { ok: true, amountDue, walletApplied }
}

export function checkoutLifetime({ tierId, useWallet = true }) {
  const orgId = getActiveOrgId()
  if (!orgId) return { ok: false, reason: 'no_org' }
  const cur = getBillingStateForOrg(orgId)
  if (!cur) return { ok: false, reason: 'no_state' }
  const tier = findLifetimeById(tierId)
  if (!tier) return { ok: false, reason: 'unknown_tier' }

  let price = tier.priceUsd
  let existingCredit = 0
  if (cur.status === 'active' && cur.planTier) {
    // Existing recurring payment credited (simplified: prorate 1 month)
    const catalog = cur.usesRestructuredTier ? RESTRUCTURED_PLANS : NORMAL_PLANS
    const curPlan = catalog.find((p) => p.id === cur.planTier)
    if (curPlan && curPlan.priceUsd > 0) {
      existingCredit = curPlan.priceUsd
      price = Math.max(0, price - existingCredit)
    }
  } else if (cur.lifetimeTier) {
    // Upgrade existing lifetime — pay the difference
    const existing = findLifetimeById(cur.lifetimeTier)
    if (existing && existing.priceUsd < tier.priceUsd) {
      existingCredit = existing.priceUsd
      price = Math.max(0, tier.priceUsd - existing.priceUsd)
    } else {
      return { ok: false, reason: 'cannot_downgrade_lifetime' }
    }
  }

  let walletApplied = 0
  let amountDue = price
  if (useWallet) {
    const w = getWallet(orgId)
    walletApplied = Math.min(w.balance, price)
    amountDue = Math.max(0, price - walletApplied)
  }
  if (walletApplied > 0) debitWallet(orgId, walletApplied)

  appendTransaction(orgId, {
    type: cur.lifetimeTier ? 'lifetime_upgrade' : 'lifetime_purchase',
    amount: tier.priceUsd,
    description: `${tier.name} — Lifetime`,
    walletApplied,
    amountDue,
    existingCredit,
    lifetimeTierId: tier.id,
  })

  setBillingStateForOrg(orgId, {
    status: 'lifetime_active',
    lifetimeTier: tier.id,
    lifetimePurchasedAt: new Date().toISOString(),
    planTier: null,
    currentPeriodEnd: null,
    canceledAt: null,
    trialState: null,
    trialExpiresAt: null,
  })
  emitStateChanged()
  return { ok: true, amountDue, walletApplied, existingCredit }
}

export function addWalletCredit(amount) {
  const orgId = getActiveOrgId()
  if (!orgId) return null
  setWalletBalance(orgId, getWallet(orgId).balance + amount)
  appendTransaction(orgId, {
    type: 'credit_added',
    amount,
    description: `Wallet credit added ($${amount.toFixed(2)})`,
  })
  return getWallet(orgId)
}

// ---------------------------------------------------------------------------
// Derived view-model for Billing Overview. UI calls this instead of
// reading raw state — keeps display rules in one place.
// ---------------------------------------------------------------------------

export function getOverviewViewModel() {
  const orgId = getActiveOrgId()
  if (!orgId) return null
  // Use getActiveOrgBilling (lazy-seeds new orgs to default normal user)
  // instead of getBillingStateForOrg so first-view Overview never returns null.
  const state = getActiveOrgBilling()
  if (!state) return null
  const wallet = getWallet(orgId)
  const txs = getTransactions(orgId)
  const ar = getAutoRecharge(orgId)
  const serverCount = countActiveServers()
  const currentPlan = getPlanForOrg(orgId)

  const trialDaysRemaining = (() => {
    if (!state.trialExpiresAt) return null
    const ms = new Date(state.trialExpiresAt).getTime() - Date.now()
    if (ms <= 0) return 0
    return Math.ceil(ms / 86400000)
  })()

  let currentAccessLabel = 'Free'
  let statusLabel = 'Active'
  let statusTone = 'neutral'
  let recommendedAction = null

  if (state.status === 'lifetime_active') {
    currentAccessLabel = state.lifetimeTier?.replace(/^lifetime_/, 'Lifetime ').replace(/_/g, ' ') || 'Lifetime'
    statusLabel = 'Lifetime active'
    statusTone = 'success'
  } else if (state.trialState === 'trial_active') {
    // Trial is a state, not a plan. Wording: "Current access: Trial"
    currentAccessLabel = 'Trial'
    statusLabel = trialDaysRemaining <= TRIAL_EXPIRY_SOON_DAYS ? `Trial ends in ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'}` : `Trial — ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} left`
    statusTone = trialDaysRemaining <= TRIAL_EXPIRY_SOON_DAYS ? 'warning' : 'info'
    if (trialDaysRemaining <= TRIAL_EXPIRY_SOON_DAYS) {
      recommendedAction = {
        tone: 'warning',
        title: 'Trial ending soon',
        body: `Your trial expires in ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'}. Choose a plan or add wallet credit before ${new Date(state.trialExpiresAt).toLocaleDateString()}.`,
        cta: { label: 'Choose a plan', href: '/billing/plans' },
      }
    }
  } else if (state.trialState === 'trial_expired') {
    currentAccessLabel = 'Free'
    statusLabel = 'Trial expired'
    statusTone = 'warning'
    recommendedAction = {
      tone: 'warning',
      title: 'Trial ended',
      body: 'Your trial has expired. Choose a paid plan to keep your current access, or continue with Free plan limits.',
      cta: { label: 'Choose a plan', href: '/billing/plans' },
    }
  } else if (state.status === 'canceled') {
    const plan = getPlanForOrg(orgId)
    currentAccessLabel = plan ? plan.name : 'Free'
    statusLabel = 'Recurring canceled'
    statusTone = 'warning'
    recommendedAction = {
      tone: 'warning',
      title: 'Subscription canceled',
      body: 'Your plan will not renew. Resume anytime to keep paid access.',
      cta: { label: 'Resume plan', action: 'resume' },
    }
  } else if (state.planTier && state.planTier !== 'free') {
    const plan = getPlanForOrg(orgId)
    currentAccessLabel = plan ? plan.name : state.planTier
    statusLabel = state.trialState === 'trial_converted' ? 'Converted from trial' : 'Active'
    statusTone = 'success'
    // Wallet vs renewal check
    const planPrice = plan?.priceUsd || 0
    if (planPrice > 0 && state.currentPeriodEnd && wallet.balance < planPrice) {
      recommendedAction = {
        tone: 'warning',
        title: 'Wallet below next renewal',
        body: `Next renewal on ${new Date(state.currentPeriodEnd).toLocaleDateString()} needs $${planPrice.toFixed(2)}. Current balance: $${wallet.balance.toFixed(2)}.`,
        cta: { label: 'Add wallet credit', href: '/billing/wallet' },
      }
    }
  } else if (state.legacyInfo) {
    currentAccessLabel = state.legacyInfo.name || 'Legacy'
    statusLabel = 'Legacy / grandfathered'
    statusTone = 'info'
  } else if (state.trialState === 'trial_eligible') {
    currentAccessLabel = 'Free'
    statusLabel = 'Trial eligible'
    statusTone = 'info'
    recommendedAction = {
      tone: 'info',
      title: 'Start your free trial',
      body: 'Try Self Managed tier features for 14 days at no cost.',
      cta: { label: 'Start trial', action: 'start_trial' },
    }
  } else {
    currentAccessLabel = 'Free'
    statusLabel = 'Active'
    statusTone = 'neutral'
    if (serverCount > 1) {
      recommendedAction = {
        tone: 'info',
        title: 'You may be outgrowing Free',
        body: `This org has ${serverCount} servers. Free plan supports 1. Upgrade for more capacity.`,
        cta: { label: 'See plans', href: '/billing/plans' },
      }
    }
  }

  return {
    state,
    wallet,
    transactions: txs.slice(0, 5),
    autoRecharge: ar,
    serverCount,
    currentAccessLabel,
    statusLabel,
    statusTone,
    recommendedAction,
    trialDaysRemaining,
    currentPlan,
    // nextChargeAt / nextChargeAmount derived from currentPlan + state. We
    // only show a 'Next charge' row when the user is on a paid plan with
    // a known renewal date. Trial / lifetime / free / canceled are handled
    // below.
    nextChargeAt: state.currentPeriodEnd || null,
    nextChargeAmount: currentPlan?.priceUsd || 0,
    trialEndAt: state.trialExpiresAt || null,
    isLifetime: state.status === 'lifetime_active',
    lifetimeTier: state.lifetimeTier || null,
  }
}

// ---------------------------------------------------------------------------
// Plan-card disabled reason — used by the Plans page to explain why a
// plan can't be picked instead of just greying it out.
// ---------------------------------------------------------------------------

export function getPlanDisabledReason(plan, state, serverCount) {
  if (!state) return null
  if (plan.contactSales) return null // shown separately, not as disabled

  // Lifetime users manage their deal in the lifetime section; the
  // recurring picker is not the right surface for them.
  if (state.status === 'lifetime_active') {
    return 'Lifetime is active. Manage your lifetime deal instead.'
  }
  // Rank-based no-downgrade was removed in round 7 so users can move
  // down through the picker and see the impact preview before
  // confirming. Server-limit gates below were also removed: the impact
  // dialog (CheckoutReviewDialog) now surfaces a server-overhang
  // warning when the new plan would strand existing servers, so the
  // user is informed instead of blocked. A real backend would also
  // need proration and refund logic here — out of scope for the
  // mock-only billing API.
  return null
}
// Re-export storage primitives so consumers (e.g. ExtraSlotsCard) can
// import them from billingApi without reaching into centralApi.
export { read, write, readRaw, writeRaw, KEYS }
