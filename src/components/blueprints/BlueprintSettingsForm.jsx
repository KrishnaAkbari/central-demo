'use client'

import { useMemo } from 'react'
import { Info, Eye } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  WP_LANGUAGES, WP_TIMEZONES,
  WP_DATE_FORMATS, WP_TIME_FORMATS,
  WP_PERMALINK_STRUCTURES,
} from '@/data/wpCatalog'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// BlueprintSettingsForm — WordPress-level settings.
//
// Each field has a label and an inline description (plain English, 1 line)
// so the user knows what every option does without guessing.
//
// Props:
//   settings    — settings object
//   onChange    — (nextSettings) => void
//   onlySection — optional string or string[] limiting which sections render.
//                 Allowed ids: 'locale', 'permalink', 'privacy', 'debug'.
//                 When omitted, all four sections render in order.
// ---------------------------------------------------------------------------

export function BlueprintSettingsForm({ settings, onChange, onlySection }) {
  const update = (key, value) => onChange({ ...settings, [key]: value })

  const show = (id) => {
    if (!onlySection) return true
    return Array.isArray(onlySection) ? onlySection.includes(id) : onlySection === id
  }

  return (
    <div className="space-y-8">
      {show('locale') && (
        <LocaleSection settings={settings} update={update} />
      )}
      {show('permalink') && (
        <PermalinkSection settings={settings} update={update} />
      )}
      {show('privacy') && (
        <PrivacySection settings={settings} update={update} />
      )}
      {show('debug') && (
        <DebugSection settings={settings} update={update} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function LocaleSection({ settings, update }) {
  return (
    <section className="space-y-4">
      <Header
        title="Locale"
        description="Site language, timezone, and how dates and times display on the front-end."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field
          label="Site language"
          htmlFor="bp-language"
          description="Used for admin labels, default content, and how dates render for visitors."
        >
          <NativeSelect
            id="bp-language"
            value={settings.language}
            onChange={(v) => update('language', v)}
            options={WP_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          />
        </Field>

        <Field
          label="Timezone"
          htmlFor="bp-timezone"
          description="Used for scheduled posts and timestamps. Should match your server's region."
        >
          <NativeSelect
            id="bp-timezone"
            value={settings.timezone}
            onChange={(v) => update('timezone', v)}
            options={WP_TIMEZONES.map((t) => ({ value: t, label: t }))}
          />
        </Field>

        <Field
          label="Date format"
          htmlFor="bp-date-format"
          description="How dates are shown to visitors. Changes only affect new posts."
          preview={formatPreview(settings.dateFormat)}
        >
          <NativeSelect
            id="bp-date-format"
            value={settings.dateFormat}
            onChange={(v) => update('dateFormat', v)}
            options={WP_DATE_FORMATS.map((f) => ({ value: f.value, label: f.label }))}
          />
        </Field>

        <Field
          label="Time format"
          htmlFor="bp-time-format"
          description="How times appear alongside dates. e.g. 14:34 vs 2:34 pm."
          preview={formatPreview(settings.timeFormat)}
        >
          <NativeSelect
            id="bp-time-format"
            value={settings.timeFormat}
            onChange={(v) => update('timeFormat', v)}
            options={WP_TIME_FORMATS.map((f) => ({ value: f.value, label: f.label }))}
          />
        </Field>
      </div>
      <LocalePreview settings={settings} />
    </section>
  )
}

function LocalePreview({ settings }) {
  // Locale-aware preview using Intl.DateTimeFormat so visitors in fr_FR
  // see "18 décembre 2026" while en_US shows "December 18, 2026". Falls back
  // to the manual formatter if the browser doesn't know the language.
  const sampleDate = useMemo(() => new Date(2026, 11, 18, 14, 34), [])
  const samplePreview = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(settings.language, {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(sampleDate)
    } catch {
      return `${settings.language.toUpperCase()} (locale not supported by browser)`
    }
  }, [settings.language, sampleDate])

  const tzAbbr = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat(settings.language, {
        timeZone: settings.timezone,
        timeZoneName: 'short',
      }).formatToParts(sampleDate)
      return parts.find((p) => p.type === 'timeZoneName')?.value || settings.timezone
    } catch {
      return settings.timezone
    }
  }, [settings.timezone, settings.language, sampleDate])

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <Eye className="h-3.5 w-3.5 text-slate-400" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Live preview</p>
        <span className="text-2xs text-slate-500 dark:text-slate-400">— what visitors will see</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <div>
          <p className="text-2xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Sample post date</p>
          <p className="font-mono text-slate-800 dark:text-slate-100">{samplePreview}</p>
        </div>
        <div>
          <p className="text-2xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Timezone</p>
          <p className="font-mono text-slate-800 dark:text-slate-100">{tzAbbr}</p>
        </div>
      </div>
    </div>
  )
}

function PermalinkSection({ settings, update }) {
  return (
    <section className="space-y-4">
      <Header
        title="Permalinks"
        description="How post and page URLs are built. Affects SEO and readability."
      />
      <Field
        label="Permalink structure"
        htmlFor="bp-permalink"
        description="Use /%postname%/ for SEO-friendly URLs. Plain (default) leaves IDs in the URL."
        preview={permalinkPreview(settings.permalinkStructure, 'hello-world')}
      >
        <NativeSelect
          id="bp-permalink"
          value={settings.permalinkStructure}
          onChange={(v) => update('permalinkStructure', v)}
          options={WP_PERMALINK_STRUCTURES.map((p) => ({ value: p.value, label: p.label }))}
        />
      </Field>
    </section>
  )
}

function PrivacySection({ settings, update }) {
  return (
    <section className="space-y-4">
      <Header
        title="Privacy & files"
        description="Search-engine visibility and how uploaded media is organized."
        advanced
      />
      <div className="space-y-3">
        <Toggle
          label="Discourage search engines from indexing this site"
          description="Adds <meta name='robots' content='noindex'>. Search engines may ignore it."
          checked={settings.disableSearchIndexing}
          onChange={(v) => update('disableSearchIndexing', v)}
        />
        <Toggle
          label="Organize uploads into month- and year-based folders"
          description="Files land under /wp-content/uploads/2026/07/. Helps on large media libraries."
          checked={settings.organizeUploads}
          onChange={(v) => update('organizeUploads', v)}
        />
      </div>
    </section>
  )
}

function DebugSection({ settings, update }) {
  return (
    <section className="space-y-4">
      <Header
        title="Debug"
        description="Developer-facing switches. Leave off for production sites."
        advanced
      />
      <div className="space-y-3">
        <Toggle
          label="Debug mode (WP_DEBUG)"
          description="Shows PHP notices, warnings, and errors in admin (and sometimes on the front end)."
          checked={settings.debugMode}
          onChange={(v) => update('debugMode', v)}
          warning
        />
        <Toggle
          label="Debug log (WP_DEBUG_LOG)"
          description="Writes errors to /wp-content/debug.log. Useful for support tickets."
          checked={settings.debugLog}
          onChange={(v) => update('debugLog', v)}
          warning
        />
        <Toggle
          label="Display errors on screen (WP_DEBUG_DISPLAY)"
          description="Shows PHP errors inline. Disable on public-facing sites."
          checked={settings.displayErrors}
          onChange={(v) => update('displayErrors', v)}
          warning
        />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Header — section title + description, optionally marked Advanced
// ---------------------------------------------------------------------------

function Header({ title, description, advanced = false }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h4>
        {advanced && (
          <span className="inline-flex items-center h-4 px-1.5 rounded text-2xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            Advanced
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field — label + control + description + optional preview
// ---------------------------------------------------------------------------

function Field({ label, htmlFor, description, preview, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
      </Label>
      {children}
      {description && (
        <p className="text-2xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      )}
      {preview && (
        <p className="text-2xs text-slate-500 dark:text-slate-400 font-mono">{preview}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// NativeSelect — styled <select> with consistent look
// ---------------------------------------------------------------------------

function NativeSelect({ id, value, onChange, options }) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 w-full pl-3 pr-9 rounded-lg border border-slate-200 dark:border-slate-700',
          'bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white',
          'appearance-none cursor-pointer',
          'hover:border-slate-300 dark:hover:border-slate-600',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500',
          'transition-colors',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toggle — switch with label + description
// ---------------------------------------------------------------------------

function Toggle({ label, description, checked, onChange, warning = false }) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'shrink-0 mt-0.5 relative h-6 w-11 rounded-full transition-colors',
          checked
            ? 'bg-indigo-600 dark:bg-indigo-500'
            : 'bg-slate-200 dark:bg-slate-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium',
          warning && checked
            ? 'text-amber-700 dark:text-amber-300'
            : 'text-slate-900 dark:text-white',
        )}>
          {warning && checked && (
            <Info className="inline h-3.5 w-3.5 -mt-0.5 mr-1" />
          )}
          {label}
        </p>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Preview helpers
// ---------------------------------------------------------------------------

function formatPreview(format) {
  return formatDate(new Date(2026, 11, 18, 14, 34), format)
}

function formatDate(date, format) {
  const map = {
    'Y': date.getFullYear(),
    'y': String(date.getFullYear()).slice(-2),
    'm': String(date.getMonth() + 1).padStart(2, '0'),
    'n': date.getMonth() + 1,
    'd': String(date.getDate()).padStart(2, '0'),
    'j': date.getDate(),
    'F': ['January','February','March','April','May','June','July','August','September','October','November','December'][date.getMonth()],
    'M': ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][date.getMonth()],
    'D': ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()],
    'g': ((date.getHours() + 11) % 12) + 1,
    'G': date.getHours(),
    'h': String(((date.getHours() + 11) % 12) + 1).padStart(2, '0'),
    'H': String(date.getHours()).padStart(2, '0'),
    'i': String(date.getMinutes()).padStart(2, '0'),
    's': String(date.getSeconds()).padStart(2, '0'),
    'a': date.getHours() < 12 ? 'am' : 'pm',
    'A': date.getHours() < 12 ? 'AM' : 'PM',
  }
  return format.replace(/[YymndjFMDgGhHisAa]/g, (m) => map[m] ?? m)
}

function permalinkPreview(structure, slug) {
  if (!structure) return '/?p=123'
  return structure
    .replace('%postname%', slug)
    .replace('%post_id%', '123')
    .replace('%year%', '2026')
    .replace('%monthnum%', '12')
    .replace('%category%', 'category')
}
