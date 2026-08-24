"use client"

// ===========================================================================
// Billing personas — 15 mock scenarios for testing all billing UI states.
//
// Each persona is a small builder that returns:
//   - billingState (the BillingState shape consumed by billingApi.js)
//   - wallet { balance, currency }
//   - transactions[] (mock history)
//   - autoRecharge settings
//   - billingDetails contact form data
//
// Keep builders small and deterministic relative to `now` — the UI never
// has to wait for live dates. Use `isoOffset(days)` to anchor dates around
// the active-org "today".
// ===========================================================================

const iso = (offset) => new Date(Date.now() + offset).toISOString()

const noDetails = { name: '', company: '', email: '', address: '', country: '', taxId: '' }
const defaultDetails = { ...noDetails, name: 'Demo Owner', email: 'owner@example.com', country: 'United States' }
const defaultAR = { enabled: false, thresholdUsd: 10, rechargeAmountUsd: 25, paymentMethod: 'card_placeholder' }
const arOn = { enabled: true, thresholdUsd: 10, rechargeAmountUsd: 50, paymentMethod: 'card_placeholder' }

// ---------------------------------------------------------------------------
// 1. normal_newbie — Normal (non-restructured) recurring Newbie user.
//    Default persona. Sees Newbie/Pro/Master/Business. No Free/Legacy/Managed/Self Managed.
// ---------------------------------------------------------------------------
const normalNewbie = {
  id: 'normal_newbie',
  label: 'Normal · Newbie',
  description: 'Normal recurring Newbie user (default persona).',
  buildBillingState: () => ({
    status: 'active',
    planStructure: 'traditional',
    planTier: 'newbie',
    trialState: 'trial_not_eligible',
    trialStartedAt: null,
    trialExpiresAt: null,
    trialInternalTier: null,
    currentPeriodEnd: iso(20 * 86400000),
    canceledAt: null,
    lifetimeTier: null,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 12, currency: 'USD' },
  transactions: [
    { createdAt: iso(-10 * 86400000), type: 'plan_renewal', amount: 12, walletApplied: 0, amountDue: 12, description: 'Newbie — Traditional', planId: 'newbie' },
  ],
  autoRecharge: arOn,
  billingDetails: defaultDetails,
}

// ---------------------------------------------------------------------------
// 2. normal_pro — Normal recurring Pro user.
// ---------------------------------------------------------------------------
const normalPro = {
  id: 'normal_pro',
  label: 'Normal · Pro',
  description: 'Normal recurring Pro user.',
  buildBillingState: () => ({
    status: 'active',
    planStructure: 'traditional',
    planTier: 'pro',
    trialState: 'trial_not_eligible',
    currentPeriodEnd: iso(18 * 86400000),
    canceledAt: null,
    lifetimeTier: null,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 29, currency: 'USD' },
  transactions: [
    { createdAt: iso(-12 * 86400000), type: 'plan_renewal', amount: 29, walletApplied: 0, amountDue: 29, description: 'Pro — Traditional', planId: 'pro' },
  ],
  autoRecharge: arOn,
  billingDetails: defaultDetails,
}

// ---------------------------------------------------------------------------
// 3. normal_master — Normal recurring Master user.
// ---------------------------------------------------------------------------
const normalMaster = {
  id: 'normal_master',
  label: 'Normal · Master',
  description: 'Normal recurring Master user.',
  buildBillingState: () => ({
    status: 'active',
    planStructure: 'traditional',
    planTier: 'master',
    trialState: 'trial_not_eligible',
    currentPeriodEnd: iso(15 * 86400000),
    canceledAt: null,
    lifetimeTier: null,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 49, currency: 'USD' },
  transactions: [
    { createdAt: iso(-15 * 86400000), type: 'plan_renewal', amount: 49, walletApplied: 0, amountDue: 49, description: 'Master — Traditional', planId: 'master' },
  ],
  autoRecharge: arOn,
  billingDetails: defaultDetails,
}

// ---------------------------------------------------------------------------
// 4. normal_business — Normal recurring Business user. Top tier, no downgrade.
// ---------------------------------------------------------------------------
const normalBusiness = {
  id: 'normal_business',
  label: 'Normal · Business',
  description: 'Normal recurring Business user — top tier, cannot downgrade.',
  buildBillingState: () => ({
    status: 'active',
    planStructure: 'traditional',
    planTier: 'business',
    trialState: 'trial_not_eligible',
    currentPeriodEnd: iso(10 * 86400000),
    canceledAt: null,
    lifetimeTier: null,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 69, currency: 'USD' },
  transactions: [
    { createdAt: iso(-20 * 86400000), type: 'plan_renewal', amount: 69, walletApplied: 0, amountDue: 69, description: 'Business — Traditional', planId: 'business' },
  ],
  autoRecharge: arOn,
  billingDetails: defaultDetails,
}

// ---------------------------------------------------------------------------
// 5. current_free — User currently on Free plan. Free is shown because
//    current sub is Free. Otherwise Free is hidden.
// ---------------------------------------------------------------------------
const currentFree = {
  id: 'current_free',
  label: 'Current · Free',
  description: 'User currently on the Free plan.',
  buildBillingState: () => ({
    status: 'active',
    planStructure: 'traditional',
    planTier: 'free',
    trialState: 'trial_not_eligible',
    currentPeriodEnd: null,
    canceledAt: null,
    lifetimeTier: null,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 0, currency: 'USD' },
  transactions: [],
  autoRecharge: defaultAR,
  billingDetails: noDetails,
}

// ---------------------------------------------------------------------------
// 6. legacy — User on a legacy/grandfathered plan. Legacy shown only
//    because current sub is Legacy. Price comes from legacyInfo.
// ---------------------------------------------------------------------------
const legacy = {
  id: 'legacy',
  label: 'Legacy',
  description: 'User on a dynamic grandfathered plan. Legacy visible because current sub is Legacy.',
  buildBillingState: () => ({
    status: 'active',
    planStructure: 'traditional',
    planTier: null,
    trialState: 'trial_not_eligible',
    currentPeriodEnd: null,
    canceledAt: null,
    lifetimeTier: null,
    usesRestructuredTier: false,
    legacyInfo: {
      name: 'Legacy Pro 2023',
      originalPriceUsd: 24,
      originalPlanId: 'pro_2023',
      grantedAt: iso(-365 * 86400000),
    },
  }),
  wallet: { balance: 0, currency: 'USD' },
  transactions: [],
  autoRecharge: defaultAR,
  billingDetails: noDetails,
}

// ---------------------------------------------------------------------------
// 7. restructured_managed — Restructured user on Managed (Newbie internal).
// ---------------------------------------------------------------------------
const restructuredManaged = {
  id: 'restructured_managed',
  label: 'Restructured · Managed',
  description: 'Restructured user on Managed (Newbie display) plan.',
  buildBillingState: () => ({
    status: 'active',
    planStructure: 'restructured',
    planTier: 'managed',
    trialState: 'trial_converted',
    currentPeriodEnd: iso(22 * 86400000),
    canceledAt: null,
    lifetimeTier: null,
    usesRestructuredTier: true,
    legacyInfo: null,
  }),
  wallet: { balance: 0, currency: 'USD' },
  transactions: [
    { createdAt: iso(-8 * 86400000), type: 'plan_renewal', amount: 12, walletApplied: 0, amountDue: 12, description: 'Managed — Restructured', planId: 'managed' },
  ],
  autoRecharge: arOn,
  billingDetails: defaultDetails,
}

// ---------------------------------------------------------------------------
// 8. restructured_self_managed — Restructured user on Self Managed (Business internal).
// ---------------------------------------------------------------------------
const restructuredSelfManaged = {
  id: 'restructured_self_managed',
  label: 'Restructured · Self Managed',
  description: 'Restructured user on Self Managed (Business display) plan.',
  buildBillingState: () => ({
    status: 'active',
    planStructure: 'restructured',
    planTier: 'self_managed',
    trialState: 'trial_converted',
    currentPeriodEnd: iso(15 * 86400000),
    canceledAt: null,
    lifetimeTier: null,
    usesRestructuredTier: true,
    legacyInfo: null,
  }),
  wallet: { balance: 30, currency: 'USD' },
  transactions: [
    { createdAt: iso(-20 * 86400000), type: 'credit_added', amount: 30, description: 'Wallet credit added ($30.00)' },
    { createdAt: iso(-15 * 86400000), type: 'plan_renewal', amount: 69, walletApplied: 30, amountDue: 39, description: 'Self Managed — Restructured', planId: 'self_managed' },
    { createdAt: iso(-2  * 86400000), type: 'credit_added', amount: 30, description: 'Wallet credit added ($30.00)' },
  ],
  autoRecharge: arOn,
  billingDetails: defaultDetails,
}

// ---------------------------------------------------------------------------
// 9. trial_new_user — New user with active 7-day trial.
// ---------------------------------------------------------------------------
const trialNewUser = {
  id: 'trial_new_user',
  label: 'New user · 7-day trial',
  description: 'New user with active 7-day trial. Trial is not a plan card; it is a state.',
  buildBillingState: () => ({
    status: 'trial_active',
    planStructure: 'traditional',
    planTier: 'newbie',
    trialState: 'trial_active',
    trialStartedAt: iso(-3 * 86400000),
    trialExpiresAt: iso(4 * 86400000),
    trialInternalTier: 'newbie',
    currentPeriodEnd: iso(4 * 86400000),
    canceledAt: null,
    lifetimeTier: null,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 0, currency: 'USD' },
  transactions: [
    { createdAt: iso(-3 * 86400000), type: 'trial_start', amount: 0, description: 'Newbie Trial started' },
  ],
  autoRecharge: defaultAR,
  billingDetails: defaultDetails,
}

// ---------------------------------------------------------------------------
// 10. trial_expired — Trial ended. User sees Free, with prompt to pick a plan.
// ---------------------------------------------------------------------------
const trialExpired = {
  id: 'trial_expired',
  label: 'Trial expired',
  description: 'Trial ended, user is on Free. Plans page shows Newbie/Pro/Master/Business.',
  buildBillingState: () => ({
    status: 'active',
    planStructure: 'traditional',
    planTier: 'free',
    trialState: 'trial_expired',
    trialStartedAt: iso(-12 * 86400000),
    trialExpiresAt: iso(-5 * 86400000),
    currentPeriodEnd: null,
    canceledAt: null,
    lifetimeTier: null,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 0, currency: 'USD' },
  transactions: [
    { createdAt: iso(-12 * 86400000), type: 'trial_start', amount: 0, description: 'Newbie Trial started' },
    { createdAt: iso(-5 * 86400000),  type: 'trial_end',   amount: 0, description: 'Trial ended' },
  ],
  autoRecharge: defaultAR,
  billingDetails: defaultDetails,
}

// ---------------------------------------------------------------------------
// 11. lifetime_newbie_limited — Lifetime Newbie with 5 server slots.
//     Can buy extra slots at $24/server. Can upgrade to higher lifetime.
// ---------------------------------------------------------------------------
const lifetimeNewbieLimited = {
  id: 'lifetime_newbie_limited',
  label: 'Lifetime · Newbie (5 servers)',
  description: 'Lifetime Newbie — 5 server slots, $24/server extra. Can upgrade to Pro/Master/Business lifetime.',
  buildBillingState: () => ({
    status: 'lifetime_active',
    planStructure: 'traditional',
    planTier: null,
    trialState: null,
    currentPeriodEnd: null,
    canceledAt: null,
    lifetimeTier: 'lifetime_newbie',
    lifetimePurchasedAt: iso(-200 * 86400000),
    lifetimeServersLimit: 5,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 24, currency: 'USD' },
  transactions: [
    { createdAt: iso(-200 * 86400000), type: 'lifetime_purchase', amount: 499, walletApplied: 0, amountDue: 499, description: 'Newbie Lifetime — Traditional', lifetimeTierId: 'lifetime_newbie' },
    { createdAt: iso(-30  * 86400000), type: 'credit_added', amount: 24, description: 'Wallet credit added ($24.00)' },
  ],
  autoRecharge: defaultAR,
  billingDetails: defaultDetails,
}

// ---------------------------------------------------------------------------
// 12. lifetime_pro_limited — Lifetime Pro with 25 server slots.
//     $35/server extra. Can upgrade.
// ---------------------------------------------------------------------------
const lifetimeProLimited = {
  id: 'lifetime_pro_limited',
  label: 'Lifetime · Pro (25 servers)',
  description: 'Lifetime Pro — 25 server slots, $35/server extra. Can upgrade to Master/Business lifetime.',
  buildBillingState: () => ({
    status: 'lifetime_active',
    planStructure: 'traditional',
    planTier: null,
    trialState: null,
    currentPeriodEnd: null,
    canceledAt: null,
    lifetimeTier: 'lifetime_pro',
    lifetimePurchasedAt: iso(-120 * 86400000),
    lifetimeServersLimit: 25,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 0, currency: 'USD' },
  transactions: [
    { createdAt: iso(-120 * 86400000), type: 'lifetime_purchase', amount: 1299, walletApplied: 0, amountDue: 1299, description: 'Pro Lifetime — Traditional', lifetimeTierId: 'lifetime_pro' },
  ],
  autoRecharge: defaultAR,
  billingDetails: defaultDetails,
}

// ---------------------------------------------------------------------------
// 13. lifetime_master — Lifetime Master user. Top tier not reached; can upgrade to Business.
// ---------------------------------------------------------------------------
const lifetimeMaster = {
  id: 'lifetime_master',
  label: 'Lifetime · Master (75 servers)',
  description: 'Lifetime Master — 75 server slots. Can upgrade to Business lifetime.',
  buildBillingState: () => ({
    status: 'lifetime_active',
    planStructure: 'traditional',
    planTier: null,
    trialState: null,
    currentPeriodEnd: null,
    canceledAt: null,
    lifetimeTier: 'lifetime_master',
    lifetimePurchasedAt: iso(-300 * 86400000),
    lifetimeServersLimit: 75,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 0, currency: 'USD' },
  transactions: [
    { createdAt: iso(-300 * 86400000), type: 'lifetime_purchase', amount: 1699, walletApplied: 0, amountDue: 1699, description: 'Master Lifetime — Traditional', lifetimeTierId: 'lifetime_master' },
  ],
  autoRecharge: defaultAR,
  billingDetails: defaultDetails,
}

// ---------------------------------------------------------------------------
// 14. lifetime_business — Lifetime Business, top tier, no further upgrade.
// ---------------------------------------------------------------------------
const lifetimeBusiness = {
  id: 'lifetime_business',
  label: 'Lifetime · Business (unlimited)',
  description: 'Lifetime Business — top tier, unlimited servers, no further upgrade.',
  buildBillingState: () => ({
    status: 'lifetime_active',
    planStructure: 'traditional',
    planTier: null,
    trialState: null,
    currentPeriodEnd: null,
    canceledAt: null,
    lifetimeTier: 'lifetime_business',
    lifetimePurchasedAt: iso(-400 * 86400000),
    lifetimeServersLimit: null,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 100, currency: 'USD' },
  transactions: [
    { createdAt: iso(-400 * 86400000), type: 'lifetime_purchase', amount: 2299, walletApplied: 0, amountDue: 2299, description: 'Business Lifetime — Traditional', lifetimeTierId: 'lifetime_business' },
    { createdAt: iso(-60  * 86400000), type: 'credit_added',     amount: 100, description: 'Wallet credit added ($100.00)' },
  ],
  autoRecharge: defaultAR,
  billingDetails: defaultDetails,
}

// ---------------------------------------------------------------------------
// 15. non_owner_member — Non-owner organization member. Restricted access only.
// ---------------------------------------------------------------------------
const nonOwnerMember = {
  id: 'non_owner_member',
  label: 'Non-owner member (view only)',
  description: 'Member (not owner) on a Pro plan — billing shows restricted access.',
  buildBillingState: () => ({
    status: 'active',
    planStructure: 'traditional',
    planTier: 'pro',
    trialState: 'trial_not_eligible',
    currentPeriodEnd: iso(10 * 86400000),
    canceledAt: null,
    lifetimeTier: null,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 29, currency: 'USD' },
  transactions: [
    { createdAt: iso(-20 * 86400000), type: 'plan_renewal', amount: 29, walletApplied: 0, amountDue: 29, description: 'Pro — Traditional', planId: 'pro' },
  ],
  autoRecharge: arOn,
  billingDetails: defaultDetails,
}

// ---------------------------------------------------------------------------
// 16. cards_single — Normal Pro plan with ONE saved card on file (Visa ending
//     4242). Default for renewals + auto-recharge. Used to test the saved-
//     cards page happy path.
// ---------------------------------------------------------------------------
const cardsSingle = {
  id: 'cards_single',
  label: 'Cards · single',
  description: 'Pro plan with one Visa on file (default).',
  buildBillingState: () => ({
    status: 'active',
    planStructure: 'traditional',
    planTier: 'pro',
    trialState: 'trial_not_eligible',
    currentPeriodEnd: iso(10 * 86400000),
    canceledAt: null,
    lifetimeTier: null,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 14, currency: 'USD' },
  transactions: [
    { createdAt: iso(-20 * 86400000), type: 'plan_renewal', amount: 29, walletApplied: 0, amountDue: 29, description: 'Pro — Traditional', planId: 'pro' },
    { createdAt: iso(-30 * 86400000), type: 'plan_renewal', amount: 29, walletApplied: 0, amountDue: 29, description: 'Pro — Traditional', planId: 'pro' },
  ],
  autoRecharge: {
    enabled: true,
    thresholdUsd: 10,
    rechargeAmountUsd: 50,
    // The auto-recharge paymentMethod is the real saved-card id (the default).
    paymentMethod: 'card_seed_visa_4242',
  },
  billingDetails: { ...defaultDetails, name: 'Demo Owner', email: 'owner@example.com' },
  paymentMethods: {
    items: [
      {
        id: 'card_seed_visa_4242',
        brand: 'visa',
        last4: '4242',
        expMonth: 12,
        expYear: new Date().getFullYear() + 2,
        holderName: 'Demo Owner',
        billingEmail: 'owner@example.com',
        addedAt: iso(-90 * 86400000),
      },
    ],
    defaultId: 'card_seed_visa_4242',
  },
}

// ---------------------------------------------------------------------------
// 17. cards_multi — Normal Pro plan with TWO saved cards. Visa default,
//     Mastercard expiring in 45 days (warning). Auto-recharge binds to the
//     default (Visa). Used to test default-switch + soon-expiring warnings.
// ---------------------------------------------------------------------------
const cardsMulti = {
  id: 'cards_multi',
  label: 'Cards · multi',
  description: 'Two cards on file. Mastercard expires soon.',
  buildBillingState: () => ({
    status: 'active',
    planStructure: 'traditional',
    planTier: 'pro',
    trialState: 'trial_not_eligible',
    currentPeriodEnd: iso(10 * 86400000),
    canceledAt: null,
    lifetimeTier: null,
    usesRestructuredTier: false,
    legacyInfo: null,
  }),
  wallet: { balance: 8, currency: 'USD' },
  transactions: [
    { createdAt: iso(-15 * 86400000), type: 'plan_renewal', amount: 29, walletApplied: 0, amountDue: 29, description: 'Pro — Traditional', planId: 'pro' },
  ],
  autoRecharge: {
    enabled: true,
    thresholdUsd: 10,
    rechargeAmountUsd: 50,
    paymentMethod: 'card_seed_visa_4242',
  },
  billingDetails: { ...defaultDetails, name: 'Demo Owner', email: 'owner@example.com' },
  paymentMethods: {
    items: [
      {
        id: 'card_seed_visa_4242',
        brand: 'visa',
        last4: '4242',
        expMonth: 8,
        expYear: new Date().getFullYear() + 1,
        holderName: 'Demo Owner',
        billingEmail: 'owner@example.com',
        addedAt: iso(-180 * 86400000),
      },
      {
        id: 'card_seed_mc_4444',
        brand: 'mastercard',
        last4: '4444',
        // Expiry: 2 months from now (1-indexed) so the expires-soon
        // badge (≤2 months remaining) fires. Wrap December into next
        // January so the value always stays valid.
        ...(() => {
          const d = new Date()
          const m = d.getMonth() + 2
          if (m > 12) return { expMonth: m - 12, expYear: d.getFullYear() + 1 }
          return { expMonth: m, expYear: d.getFullYear() }
        })(),
        holderName: 'Demo Owner',
        billingEmail: 'owner@example.com',
        addedAt: iso(-30 * 86400000),
      },
    ],
    defaultId: 'card_seed_visa_4242',
  },
}

export const PERSONAS = [
  normalNewbie,         // 1 - DEFAULT
  normalPro,            // 2
  normalMaster,         // 3
  normalBusiness,       // 4
  currentFree,          // 5
  legacy,               // 6
  restructuredManaged,  // 7
  restructuredSelfManaged, // 8
  trialNewUser,         // 9
  trialExpired,         // 10
  lifetimeNewbieLimited,// 11
  lifetimeProLimited,   // 12
  lifetimeMaster,       // 13
  lifetimeBusiness,     // 14
  nonOwnerMember,       // 15
  cardsSingle,          // 16
  cardsMulti,           // 17
]

// Default persona for new orgs.
export const DEFAULT_PERSONA_ID = 'normal_newbie'

export function getPersonaById(id) {
  return PERSONAS.find((p) => p.id === id)
}
