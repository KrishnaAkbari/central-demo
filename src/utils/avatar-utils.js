/**
 * Avatar utilities — deterministic colors derived from an email handle.
 *
 * Used by /audit (actor avatar on each log entry) and reused by /members
 * (initial-circle for invitee rows) so both surfaces show the same actor
 * with the same color across the app.
 *
 * Palette: 8 muted Tailwind classes that read well on light and dark
 * backgrounds. Same actor → same color forever (hash-stable), so users
 * recognize their own/bad actors at a glance.
 */

const PALETTE = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200',
  'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
]

function hash(input) {
  const s = String(input || '')
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Returns the Tailwind className pair for an actor's avatar background.
 * Hashes the email so the same actor always renders the same color.
 */
export function getActorColor(email) {
  if (!email) return PALETTE[PALETTE.length - 1]
  const idx = hash(email.toLowerCase()) % PALETTE.length
  return PALETTE[idx]
}

/**
 * Returns up to 2 uppercase initials from a display name or email.
 * Handles "First Last", single-word names, and email-only inputs.
 */
export function getActorInitials(name, email) {
  const source = (name || '').trim()
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  if (email) {
    const local = email.split('@')[0] || ''
    return local.slice(0, 2).toUpperCase() || '?'
  }
  return '?'
}
