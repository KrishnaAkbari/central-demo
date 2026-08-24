// Blueprints API — localStorage CRUD for the demo, matching the pattern
// used by centralApi.js. Wraps the raw storage layer so the store and
// components never touch localStorage directly.
//
// Storage key: 'central:wp-blueprints' (versioned so future schema
// migrations can detect old payloads and transform them).

import {
  WP_THEMES,
  WP_PLUGINS,
  DEFAULT_BLUEPRINT_SETTINGS,
} from '@/data/wpCatalog'

const KEY = 'central:wp-blueprints:v1'

// ---------------------------------------------------------------------------
// Sample blueprints seeded on first load — gives the empty state something
// to point at and lets new users understand the shape right away.
// ---------------------------------------------------------------------------

const SAMPLE_BLUEPRINTS = [
  {
    id: 'bp_blog_starter',
    name: 'Blog — Starter',
    description: 'Standard blog setup with Yoast SEO for search visibility, Akismet for spam protection, and UpdraftPlus for automated nightly backups.',
    themes: [
      { source: 'directory', slug: 'elisen-photography', name: 'Elisen Photography', isDefault: true },
    ],
    plugins: [
      { source: 'directory', slug: 'yoast-seo',  name: 'Yoast SEO',     enabled: true, isDefault: true },
      { source: 'directory', slug: 'akismet',    name: 'Akismet',       enabled: true },
      { source: 'directory', slug: 'updraftplus', name: 'UpdraftPlus',   enabled: true },
    ],
    settings: {
      ...DEFAULT_BLUEPRINT_SETTINGS,
      timezone: 'America/New_York',
      organizeUploads: true,
    },
    createdAt: '2026-07-15T09:00:00.000Z',
    updatedAt: '2026-07-19T14:23:00.000Z',
    usageCount: 7,
  },
  {
    id: 'bp_business_pro',
    name: 'Business — Pro Stack',
    description: 'Production-ready stack with Wordfence firewall, WP Rocket caching, WPForms for contact pages, Yoast SEO, SSL enforced, and automated backups.',
    themes: [
      { source: 'directory', slug: 'service-business', name: 'Service Business', isDefault: true },
    ],
    plugins: [
      { source: 'directory', slug: 'wordfence',         name: 'Wordfence Security', enabled: true, isDefault: true },
      { source: 'directory', slug: 'wp-rocket',         name: 'WP Rocket',           enabled: true },
      { source: 'directory', slug: 'wpforms-lite',      name: 'WPForms Lite',        enabled: true },
      { source: 'directory', slug: 'yoast-seo',         name: 'Yoast SEO',           enabled: true },
      { source: 'directory', slug: 'really-simple-ssl', name: 'Really Simple SSL',   enabled: true },
      { source: 'directory', slug: 'updraftplus',       name: 'UpdraftPlus',         enabled: true },
    ],
    settings: {
      ...DEFAULT_BLUEPRINT_SETTINGS,
      language: 'en_GB',
      timezone: 'Europe/London',
      permalinkStructure: '/%category%/%postname%/',
      organizeUploads: true,
      debugLog: true,
    },
    createdAt: '2026-06-28T11:00:00.000Z',
    updatedAt: '2026-07-21T08:45:00.000Z',
    usageCount: 12,
  },
  {
    id: 'bp_ecom_lean',
    name: 'E-commerce — Lean',
    description: 'Lightweight WooCommerce storefront with Stripe + PayPal checkout, ShortPixel image optimization for product catalogs, and Yoast SEO for product pages.',
    themes: [
      { source: 'directory', slug: 'fse-ecommerce',   name: 'FSE eCommerce',   isDefault: true },
    ],
    plugins: [
      { source: 'directory', slug: 'woocommerce',     name: 'WooCommerce',               enabled: true, isDefault: true },
      { source: 'directory', slug: 'flavor-payments', name: 'Flavor Payments',           enabled: true },
      { source: 'directory', slug: 'yoast-seo',       name: 'Yoast SEO',                 enabled: true },
      { source: 'directory', slug: 'shortpixel',      name: 'ShortPixel Image Optimizer', enabled: true },
    ],
    settings: {
      ...DEFAULT_BLUEPRINT_SETTINGS,
      timezone: 'America/Los_Angeles',
      dateFormat: 'M j, Y',
      timeFormat: 'g:i a',
      disableSearchIndexing: true,
      organizeUploads: true,
    },
    createdAt: '2026-07-10T15:30:00.000Z',
    updatedAt: '2026-07-20T16:10:00.000Z',
    usageCount: 3,
  },
  {
    id: 'bp_dev_local',
    name: 'Dev — Local with Debug',
    description: 'Local development setup with debug mode on, error display enabled, and Duplicate Page for quick iteration. No-index is on so search engines skip it.',
    themes: [
      { source: 'directory', slug: 'thryvewp-fse-pulse', name: 'Thryvewp FSE Pulse', isDefault: true },
    ],
    plugins: [
      { source: 'directory', slug: 'query-monitor',   name: 'Query Monitor',  enabled: true, isDefault: true },
      { source: 'directory', slug: 'duplicate-page',  name: 'Duplicate Page', enabled: true },
    ],
    settings: {
      ...DEFAULT_BLUEPRINT_SETTINGS,
      timezone: 'UTC',
      debugMode: true,
      debugLog: true,
      displayErrors: true,
      disableSearchIndexing: true,
    },
    createdAt: '2026-07-05T10:00:00.000Z',
    updatedAt: '2026-07-22T04:12:00.000Z',
    usageCount: 24,
  },
]

// ---------------------------------------------------------------------------
// Raw storage helpers
// ---------------------------------------------------------------------------

function readRaw() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) {
      // First load — seed with samples
      writeRaw(SAMPLE_BLUEPRINTS)
      return SAMPLE_BLUEPRINTS
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(blueprints) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(blueprints))
    // Notify any listeners (multi-tab + same-tab store subscribers)
    window.dispatchEvent(new CustomEvent('blueprints:changed'))
  } catch (err) {
    console.error('blueprintsApi: write failed', err)
  }
}

function nextId() {
  return `bp_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listBlueprints() {
  // Simulate async for API parity with future real backend
  await Promise.resolve()
  const blueprints = readRaw()
  // Sort by updatedAt desc — most recently changed first
  return [...blueprints].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export async function getBlueprint(id) {
  await Promise.resolve()
  return readRaw().find((b) => b.id === id) || null
}

export async function createBlueprint(input) {
  await Promise.resolve()
  const now = new Date().toISOString()
  const blueprint = {
    id: nextId(),
    name: (input.name || 'Untitled blueprint').trim(),
    description: (input.description || '').trim(),
    themes: input.themes && input.themes.length > 0
      ? input.themes
      : [{ source: 'directory', slug: 'twentytwentyfour', name: 'Twenty Twenty-Four', isDefault: true }],
    plugins: input.plugins || [],
    settings: { ...DEFAULT_BLUEPRINT_SETTINGS, ...(input.settings || {}) },
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
  }
  const all = readRaw()
  all.push(blueprint)
  writeRaw(all)
  return blueprint
}

export async function updateBlueprint(id, patch) {
  await Promise.resolve()
  const all = readRaw()
  const idx = all.findIndex((b) => b.id === id)
  if (idx === -1) throw new Error(`Blueprint ${id} not found`)
  // Existing themes array, with a fallback through the old single-`theme`
  // field for legacy blueprints. Extracted to a named const so the operator
  // precedence is unambiguous — the previous inline version combined ??
  // and ?:, which silently discarded the user's edits on every save.
  const existingThemes = all[idx].themes
    ?? (all[idx].theme ? [{ ...all[idx].theme, isDefault: true }] : [])
  const merged = {
    ...all[idx],
    ...patch,
    settings: { ...all[idx].settings, ...(patch.settings || {}) },
    themes: patch.themes ?? existingThemes,
    plugins: patch.plugins ?? all[idx].plugins,
    updatedAt: new Date().toISOString(),
  }
  // Backwards compat: if a legacy `theme` field somehow lingered and
  // `themes` ended up empty, migrate it.
  if (!merged.themes?.length && merged.theme) {
    merged.themes = [{ ...merged.theme, isDefault: true }]
    delete merged.theme
  }
  all[idx] = merged
  writeRaw(all)
  return merged
}

export async function deleteBlueprint(id) {
  await Promise.resolve()
  const all = readRaw().filter((b) => b.id !== id)
  writeRaw(all)
  return { ok: true }
}

export async function duplicateBlueprint(id) {
  await Promise.resolve()
  const all = readRaw()
  const original = all.find((b) => b.id === id)
  if (!original) throw new Error(`Blueprint ${id} not found`)
  const now = new Date().toISOString()
  const copy = {
    ...JSON.parse(JSON.stringify(original)),
    id: nextId(),
    name: `${original.name} (copy)`,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  }
  all.push(copy)
  writeRaw(all)
  return copy
}

// Reset back to the seeded sample set — useful for demos / dev
export async function resetBlueprints() {
  writeRaw(SAMPLE_BLUEPRINTS)
  return SAMPLE_BLUEPRINTS
}

// ---------------------------------------------------------------------------
// Aggregate stats for the list page header
// ---------------------------------------------------------------------------

export async function getBlueprintStats() {
  const all = await listBlueprints()
  const totalUsages = all.reduce((sum, b) => sum + (b.usageCount || 0), 0)
  const mostUsed = all.reduce((max, b) =>
    (b.usageCount || 0) > (max?.usageCount || 0) ? b : max, null
  )
  const now = Date.now()
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000
  const usedThisMonth = all.filter((b) => {
    if (!b.usageCount) return false
    // Approximate: if updatedAt within last 30d and has uses
    return new Date(b.updatedAt).getTime() > monthAgo && b.usageCount > 0
  }).length

  return {
    total: all.length,
    totalUsages,
    mostUsed,
    usedThisMonth,
  }
}

// Re-export the catalogs so components can grab them without an extra import
export { WP_THEMES, WP_PLUGINS }
