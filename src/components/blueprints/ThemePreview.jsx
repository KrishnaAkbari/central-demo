'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// ThemePreview — shows the actual WordPress.org theme screenshot when one
// exists at ts.w.org, otherwise a themed SVG design system mockup.
//
// Screenshot source: https://ts.w.org/wp-content/themes/{slug}/screenshot.png
// — the official WordPress.org theme screenshot CDN. Returns a 1200×900 PNG
// of the theme's actual home page. Lighter than embedding a full HTML page
// in an iframe, no sandbox/security concerns, no rate-limit problems.
//
// Themes not in the WordPress.org directory (custom themes, premium
// themes like Divi/Avada, our flavor-* family) fall through to the SVG
// mockup with the theme's own gradient palette. The "Design preview"
// badge makes the fallback obvious — it's a placeholder, not a fake
// screenshot.
//
// Props:
//   screenshotUrl — string URL to ts.w.org (optional)
//   themeColor    — Tailwind gradient classes for the SVG fallback
//   themeName     — used for alt text and to pick typography
// ---------------------------------------------------------------------------

// Build the screenshot URL for any slug. Themes that don't exist on
// ts.w.org (premium or custom themes like the flavor-* family) get a 404
// from the browser — the <img>'s onError handler in ScreenshotImage
// below catches that and falls back to the themed SVG mockup automatically.
// So we don't need an explicit allowlist anymore — every WP.org directory
// theme just works.
const SCREENSHOT_VERSION = '1.0.2'

export function getThemeScreenshotUrl(slug) {
  if (!slug) return null
  return `https://ts.w.org/wp-content/themes/${slug}/screenshot.png?ver=${SCREENSHOT_VERSION}`
}

const TYPOGRAPHY = {
  flavor: { heading: 'font-serif', body: 'font-sans', weight: 'font-bold' },
  astra: { heading: 'font-sans tracking-tight', body: 'font-sans', weight: 'font-extrabold' },
  generatepress: { heading: 'font-sans uppercase tracking-widest', body: 'font-sans', weight: 'font-semibold' },
  flavor_blog: { heading: 'font-serif italic', body: 'font-sans', weight: 'font-black' },
  twentytwentyfour: { heading: 'font-sans font-light', body: 'font-sans', weight: 'font-normal' },
}

function getTypography(themeName = '') {
  const key = Object.keys(TYPOGRAPHY).find((k) => themeName.toLowerCase().includes(k))
  return TYPOGRAPHY[key] || TYPOGRAPHY.flavor
}

export function ThemePreview({ screenshotUrl, themeColor, themeName, className, showBadge = true }) {
  if (screenshotUrl) {
    return <ScreenshotImage url={screenshotUrl} name={themeName} className={className} showBadge={showBadge} />
  }
  return <ThemedMockup color={themeColor} name={themeName} className={className} />
}

// ---------------------------------------------------------------------------
// ScreenshotImage — the actual WordPress.org screenshot.
// object-cover crops to fit the 16:9-ish card area; twentytwentyfour's
// screenshot is 4:3 so the top/bottom gets cropped slightly to fill.
// ---------------------------------------------------------------------------

function ScreenshotImage({ url, name, className, showBadge = true }) {
  const [errored, setErrored] = useState(false)

  if (errored) {
    return <ThemedMockup color={null} name={name} className={className} />
  }
  return (
    <div className={cn('relative w-full overflow-hidden bg-slate-100 dark:bg-slate-800', className || 'h-36')}>
      <img
        src={url}
        alt={`${name} screenshot from WordPress.org`}
        loading="lazy"
        onError={() => setErrored(true)}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {showBadge && (
        <div className="absolute top-2 right-2 inline-flex items-center gap-1 h-5 px-1.5 rounded bg-black/50 backdrop-blur-sm text-2xs font-medium text-white">
          <Eye className="h-2.5 w-2.5" />
          Screenshot
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ThemedMockup — fallback when no WordPress.org screenshot is available.
// ---------------------------------------------------------------------------

function ThemedMockup({ color, name, className }) {
  const typo = getTypography(name)
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-gradient-to-br',
        className || 'h-36',
        color || 'from-slate-500 to-slate-700',
      )}
      aria-label={`${name} design preview`}
      role="img"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-25 mix-blend-overlay"
        style={{
          backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.5) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.15) 0%, transparent 50%)',
        }}
      />
      <svg viewBox="0 0 320 144" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="320" height="18" fill="rgba(0,0,0,0.2)" />
        <rect x="0" y="0" width="320" height="18" fill="rgba(255,255,255,0.05)" />
        <rect x="14" y="6" width="28" height="6" rx="1" fill="rgba(255,255,255,0.95)" />
        <rect x="210" y="7" width="14" height="4" rx="0.5" fill="rgba(255,255,255,0.5)" />
        <rect x="232" y="7" width="14" height="4" rx="0.5" fill="rgba(255,255,255,0.5)" />
        <rect x="254" y="7" width="14" height="4" rx="0.5" fill="rgba(255,255,255,0.5)" />
        <rect x="280" y="7" width="22" height="4" rx="0.5" fill="rgba(255,255,255,0.95)" />
        <g transform="translate(0, 30)">
          <rect x="20" y="0" width={typo.heading.includes('serif') ? 130 : 140} height="10" rx="1" fill="rgba(255,255,255,0.95)" />
          <rect x="20" y="14" width="160" height="4" rx="0.5" fill="rgba(255,255,255,0.55)" />
          <rect x="20" y="20" width="120" height="4" rx="0.5" fill="rgba(255,255,255,0.55)" />
          <rect x="20" y="32" width="48" height="14" rx="2" fill="rgba(255,255,255,0.95)" />
          <rect x="26" y="38" width="36" height="3" rx="0.5" fill="rgba(0,0,0,0.7)" />
          <rect x="76" y="32" width="48" height="14" rx="2" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
          <rect x="82" y="38" width="36" height="3" rx="0.5" fill="rgba(255,255,255,0.5)" />
        </g>
        <g transform="translate(0, 86)">
          <rect x="20" y="0" width="86" height="50" rx="2" fill="rgba(255,255,255,0.12)" />
          <rect x="26" y="6" width="74" height="22" rx="1" fill="rgba(255,255,255,0.18)" />
          <circle cx="63" cy="17" r="4" fill="rgba(255,255,255,0.25)" />
          <rect x="26" y="32" width="50" height="3" rx="0.5" fill="rgba(255,255,255,0.5)" />
          <rect x="26" y="38" width="68" height="2" rx="0.5" fill="rgba(255,255,255,0.35)" />
          <rect x="26" y="42" width="56" height="2" rx="0.5" fill="rgba(255,255,255,0.35)" />
          <rect x="117" y="0" width="86" height="50" rx="2" fill="rgba(255,255,255,0.12)" />
          <rect x="123" y="8" width="60" height="4" rx="0.5" fill="rgba(255,255,255,0.7)" />
          <rect x="123" y="16" width="74" height="2" rx="0.5" fill="rgba(255,255,255,0.35)" />
          <rect x="123" y="20" width="68" height="2" rx="0.5" fill="rgba(255,255,255,0.35)" />
          <rect x="123" y="24" width="60" height="2" rx="0.5" fill="rgba(255,255,255,0.35)" />
          <rect x="123" y="32" width="34" height="6" rx="1" fill="rgba(255,255,255,0.6)" />
          <rect x="214" y="0" width="86" height="50" rx="2" fill="rgba(255,255,255,0.12)" />
          <rect x="220" y="6" width="74" height="22" rx="1" fill="rgba(255,255,255,0.18)" />
          <rect x="220" y="6" width="20" height="6" rx="1" fill="rgba(255,255,255,0.4)" />
          <rect x="220" y="32" width="55" height="3" rx="0.5" fill="rgba(255,255,255,0.5)" />
          <rect x="220" y="38" width="72" height="2" rx="0.5" fill="rgba(255,255,255,0.35)" />
          <rect x="220" y="42" width="48" height="2" rx="0.5" fill="rgba(255,255,255,0.35)" />
        </g>
      </svg>
      <div className="absolute top-2 right-2 inline-flex items-center gap-1 h-5 px-1.5 rounded bg-black/40 backdrop-blur-sm text-2xs font-medium text-white z-10">
        <Eye className="h-2.5 w-2.5" />
        Design preview
      </div>
    </div>
  )
}
