// Payment methods — mock data layer for cards on file.
//
// State storage:
//   LocalStorage key "cp_payment_methods" maps orgId to:
//     { items: PaymentMethodCard[], defaultId: string | null, version: number }
//
// Each PaymentMethodCard holds only the safe-to-display fields. The full
// PAN and CVC are NEVER stored — this is a mock build, but the mock
// enforces the same shape real PCI-DSS-compliant processors enforce
// (Stripe, Adyen, Braintree, etc. all return the same shape: brand,
// last4, exp_month, exp_year, holder_name, fingerprint).
//
// Card brand is auto-detected from the BIN (first digits) at add time.
// Supported brands: visa, mastercard, amex, discover, jcb, diners,
// unionpay, unknown. Demo BINs are accepted: 4242 (Visa), 5555 (MC),
// 3782 (Amex), 6011 (Discover), 3056 (Diners). CVC length is brand-aware
// (3 for most, 4 for Amex).
//
// The auto-recharge rule reads the default card via getDefaultCard().
// Wallet-credit recharge does not need a saved card; it uses the wallet.

import { read, write, KEYS } from './centralApi'
import { getActiveOrgId } from './billingApi'

export const CARD_BRANDS = {
  visa: { label: 'Visa', gradient: 'from-indigo-500 to-blue-600', textOnCard: 'VISA' },
  mastercard: { label: 'Mastercard', gradient: 'from-red-500 to-orange-500', textOnCard: 'MC' },
  amex: { label: 'American Express', gradient: 'from-cyan-500 to-sky-600', textOnCard: 'AMEX' },
  discover: { label: 'Discover', gradient: 'from-amber-500 to-orange-600', textOnCard: 'DISC' },
  diners: { label: 'Diners Club', gradient: 'from-slate-500 to-slate-700', textOnCard: 'DINERS' },
  jcb: { label: 'JCB', gradient: 'from-emerald-500 to-teal-600', textOnCard: 'JCB' },
  unionpay: { label: 'UnionPay', gradient: 'from-rose-500 to-pink-600', textOnCard: 'UPI' },
  unknown: { label: 'Card', gradient: 'from-slate-400 to-slate-600', textOnCard: '••••' },
}

// Demo BIN ranges that auto-detect a brand. Real-world patterns extended
// with the most common network prefixes. Patterns are intentionally simple
// (first 1-4 digit string match) — luhn is checked separately.
const BIN_PATTERNS = [
  { brand: 'visa', re: /^4\d{0,15}$/ },
  { brand: 'mastercard', re: /^(5[1-5]|2[2-7])\d{0,14}$/ },
  { brand: 'amex', re: /^3[47]\d{0,13}$/ },
  { brand: 'discover', re: /^(6011|65|64[4-9]|622)\d{0,12}$/ },
  { brand: 'diners', re: /^(36|30[0-5]|3095|38|39)\d{0,12}$/ },
  { brand: 'jcb', re: /^35(28|89|[2-8]\d)\d{0,11}$/ },
  { brand: 'unionpay', re: /^62\d{0,14}$/ },
]

// Strip spaces and dashes for any card-input comparison.
function normalizeCardNumber(input) {
  return String(input || '').replace(/[\s-]/g, '')
}

// Detect brand from a normalized card number. Returns 'unknown' when no
// pattern matches.
export function detectCardBrand(input) {
  const n = normalizeCardNumber(input)
  for (const { brand, re } of BIN_PATTERNS) {
    if (re.test(n)) return brand
  }
  return 'unknown'
}

// Luhn check — the standard credit-card validation.
export function isValidLuhn(input) {
  const n = normalizeCardNumber(input)
  if (n.length < 12) return false
  let sum = 0
  let alt = false
  for (let i = n.length - 1; i >= 0; i -= 1) {
    let d = Number(n[i])
    if (Number.isNaN(d)) return false
    if (alt) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    alt = !alt
  }
  return sum % 10 === 0
}

export function expectedCvcLength(brand) {
  return brand === 'amex' ? 4 : 3
}

export function isValidExpiry(month, year) {
  const m = Number(month)
  const y = Number(year)
  if (!Number.isInteger(m) || m < 1 || m > 12) return false
  // Two-digit years: 2025 = 25, 2099 = 99. Use 20xx mapping when yy < 80
  // else 19xx — matches Stripe's expiry parsing.
  const fullYear = y < 80 ? 2000 + y : 1900 + y
  // Last day of expiry month, then compare against now.
  const lastMs = new Date(fullYear, m, 1).getTime() // first of NEXT month
  return lastMs > Date.now()
}

function makeCardId() {
  return (
    'pm_' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  )
}

// ---------------------------------------------------------------------------
// Default-state for an Org.
// ---------------------------------------------------------------------------

export const DEFAULT_PAYMENT_METHODS = {
  items: [],
  defaultId: null,
  // version lets future migrations bump and recognize old shapes.
  version: 1,
}

export function getPaymentMethods(orgId) {
  const id = orgId || getActiveOrgId()
  if (!id) return DEFAULT_PAYMENT_METHODS
  const map = read(KEYS.PAYMENT_METHODS, {})
  const v = map[id]
  if (!v || !Array.isArray(v.items)) return DEFAULT_PAYMENT_METHODS
  return v
}

export function getSavedCards(orgId) {
  return getPaymentMethods(orgId).items || []
}

// Default card (the one auto-recharge charges). Returns null when no
// default is set OR the defaultId points to a card that no longer exists.
export function getDefaultCard(orgId) {
  const v = getPaymentMethods(orgId)
  if (!v.defaultId) return null
  return v.items.find((c) => c.id === v.defaultId) || null
}

// Used-by lookup — explains to the admin which rule / subscription is
// currently charging this card, so they don't accidentally remove the
// card their renewal depends on. Reads auto-recharge settings and, for
// the current plan, deduces the renewal label from the BillingState.
export function getCardUsedBy(orgId, cardId, opts = {}) {
  const ar = read(KEYS.AUTO_RECHARGE, {})[orgId]
  if (ar && ar.paymentMethod === cardId) {
    return { kind: 'auto_recharge', label: 'Auto Recharge' }
  }
  // If card is default AND there's an active recurring plan, treat it as
  // being used by the renewal.
  const billing = read(KEYS.BILLING, {})[orgId]
  const methods = getPaymentMethods(orgId)
  if (
    methods.defaultId === cardId &&
    billing &&
    billing.planTier &&
    billing.status === 'active' &&
    !billing.canceledAt
  ) {
    const planLabel = opts.planLabelLookup || ((t) => t)
    return { kind: 'subscription', label: `${planLabel(billing.planTier)} renewal` }
  }
  return null
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

// Add a card. Validates inline; returns the stored card or throws an Error
// with a human-readable message. Single-default invariant enforced: if the
// incoming card sets `makeDefault` to true (or there are no existing
// cards, this becomes default automatically), the previous default is
// demoted.
export function addPaymentMethod(orgId, input) {
  const id = orgId || getActiveOrgId()
  if (!id) throw new Error('No active organization')

  const cardNumber = normalizeCardNumber(input.cardNumber)
  if (!isValidLuhn(cardNumber)) {
    throw new Error('Card number is invalid.')
  }
  const brand = detectCardBrand(cardNumber)
  if (brand === 'unknown') {
    throw new Error('Unsupported card brand. Use Visa/Mastercard/Amex.')
  }
  const last4 = cardNumber.slice(-4)
  const expMonth = Number(input.expMonth)
  const expYear = Number(input.expYear)
  if (!isValidExpiry(expMonth, expYear)) {
    throw new Error('Expiry must be in the future.')
  }
  const cvc = String(input.cvc || '').trim()
  if (cvc.length !== expectedCvcLength(brand)) {
    throw new Error(
      brand === 'amex'
        ? 'Amex CVC must be 4 digits.'
        : 'CVC must be 3 digits.',
    )
  }
  const holderName = String(input.holderName || '').trim()
  if (!holderName) throw new Error('Cardholder name is required.')
  if (!input.billingEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.billingEmail.trim())) {
    throw new Error('Billing email is invalid.')
  }

  const map = read(KEYS.PAYMENT_METHODS, {})
  const current = map[id] || DEFAULT_PAYMENT_METHODS
  const items = Array.isArray(current.items) ? [...current.items] : []

  const newCard = {
    id: makeCardId(),
    brand,
    last4,
    expMonth,
    expYear,
    holderName: holderName.slice(0, 80),
    billingEmail: input.billingEmail.trim().toLowerCase(),
    addedAt: new Date().toISOString(),
  }

  // Single-default: pick correctly when no cards exist yet.
  const shouldDefault =
    !!input.makeDefault || items.length === 0
  items.push(newCard)

  if (shouldDefault) {
    // Force: previously-default cards lose the flag. We're not storing the
    // flag on items; we store only defaultId at the top level — so just
    // set defaultId to the new card id.
  }

  // Also: if adding with makeDefault=true, the auto-recharge rule that
  // pointed at card_placeholder should be re-pointed to this card id.
  // Same for any rule that pointed at a card id no longer in items.
  const arMap = read(KEYS.AUTO_RECHARGE, {})
  const ar = arMap[id]
  if (
    ar &&
    (ar.paymentMethod === 'card_placeholder' || !items.slice(0, -1).some((c) => c.id === ar.paymentMethod))
  ) {
    if (shouldDefault) {
      arMap[id] = { ...ar, paymentMethod: newCard.id }
      write(KEYS.AUTO_RECHARGE, arMap)
    }
  }

  map[id] = {
    items,
    defaultId: shouldDefault ? newCard.id : current.defaultId || null,
    version: 1,
  }
  write(KEYS.PAYMENT_METHODS, map)

  // Re-dispatch so other open tabs / listeners refresh.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('billing:state-changed'))
  }

  return newCard
}

export function removePaymentMethod(orgId, cardId) {
  const id = orgId || getActiveOrgId()
  if (!id) return { ok: false, reason: 'no_org' }
  const map = read(KEYS.PAYMENT_METHODS, {})
  const current = map[id]
  if (!current) return { ok: false, reason: 'not_found' }
  const items = current.items.filter((c) => c.id !== cardId)
  if (items.length === current.items.length) {
    return { ok: false, reason: 'not_found' }
  }
  let defaultId = current.defaultId
  if (defaultId === cardId) {
    // Removed the default — promote the next available card, or null.
    defaultId = items[0] ? items[0].id : null
  }
  map[id] = { items, defaultId, version: 1 }
  write(KEYS.PAYMENT_METHODS, map)

  // Re-point auto-recharge if it was using the removed card.
  const arMap = read(KEYS.AUTO_RECHARGE, {})
  const ar = arMap[id]
  if (ar && ar.paymentMethod === cardId) {
    arMap[id] = {
      ...ar,
      paymentMethod: defaultId || 'card_placeholder',
    }
    write(KEYS.AUTO_RECHARGE, arMap)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('billing:state-changed'))
  }
  return { ok: true, removedDefault: current.defaultId === cardId }
}

export function setDefaultPaymentMethod(orgId, cardId) {
  const id = orgId || getActiveOrgId()
  if (!id) return { ok: false, reason: 'no_org' }
  const map = read(KEYS.PAYMENT_METHODS, {})
  const current = map[id]
  if (!current) return { ok: false, reason: 'not_found' }
  if (!current.items.some((c) => c.id === cardId)) {
    return { ok: false, reason: 'not_found' }
  }
  if (current.defaultId === cardId) {
    return { ok: true, unchanged: true }
  }
  map[id] = { ...current, defaultId: cardId, version: 1 }
  write(KEYS.PAYMENT_METHODS, map)

  // If auto-recharge was on the placeholder, point it at the new default
  // automatically so the user doesn't have a dangling rule.
  const arMap = read(KEYS.AUTO_RECHARGE, {})
  const ar = arMap[id]
  if (
    ar &&
    (ar.paymentMethod === 'card_placeholder' || !current.items.some((c) => c.id === ar.paymentMethod))
  ) {
    arMap[id] = { ...ar, paymentMethod: cardId }
    write(KEYS.AUTO_RECHARGE, arMap)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('billing:state-changed'))
  }
  return { ok: true, unchanged: false }
}

// Test/demo helper — seed a list of cards directly without form. Used by
// personas. Does NOT fire audit events; should be called from
// seedPersonaForOrg only.
export function seedPaymentMethodsForOrg(orgId, items, defaultId) {
  if (!orgId) return
  const map = read(KEYS.PAYMENT_METHODS, {})
  map[orgId] = {
    items: items || [],
    defaultId: defaultId || (items && items[0] ? items[0].id : null) || null,
    version: 1,
  }
  write(KEYS.PAYMENT_METHODS, map)
}
