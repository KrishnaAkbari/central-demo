'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RefreshCw,
  CreditCard,
  Plus,
  CircleDollarSign,
  ArrowDownToLine,
  Save,
  CheckCircle2,
  AlertTriangle,
  Inbox,
} from 'lucide-react'
import Link from 'next/link'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FieldRow } from '@/components/ui/field'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PersonaSwitcher } from '@/components/billing/PersonaSwitcher'
import { RestrictedAccess } from '@/components/billing/RestrictedAccess'
import {
  getActiveOrgId,
  getAutoRecharge,
  saveAutoRecharge,
  getWallet,
  getActiveOrgBilling,
} from '@/services/billingApi'
import {
  getPaymentMethods,
  getDefaultCard,
  getCardUsedBy,
  removePaymentMethod,
  setDefaultPaymentMethod,
  CARD_BRANDS,
} from '@/services/billingPaymentMethodsApi'
import { AddPaymentMethodDialog } from '@/components/billing/AddPaymentMethodDialog'
import {
  PaymentMethodCard,
  PaymentMethodCardSkeleton,
} from '@/components/billing/PaymentMethodCard'
import { useIsOwner, useBillingVersion } from '@/stores/organizationStore'
import { toast } from 'sonner'

// Mirrors TRADITIONAL_TIER_LABEL or whichever lookup is canonical in the
// rest of the codebase. Used by getCardUsedBy to render a friendly plan
// name when listing which card is charged for which subscription.
const PLAN_TIER_LABEL = {
  newbie: 'Newbie',
  pro: 'Pro',
  master: 'Master',
  business: 'Business',
  free: 'Free',
}

// Sensible bounds. User can pick any non-negative amount; threshold must
// never exceed the recharge amount or the trigger would never fire.
const LIMITS = {
  thresholdUsd: { min: 1, max: 1000, step: 1 },
  rechargeAmountUsd: { min: 1, max: 5000, step: 1 },
}

const DEFAULTS = {
  enabled: false,
  thresholdUsd: 10,
  rechargeAmountUsd: 25,
  paymentMethod: 'card_placeholder',
}

export default function BillingAutoRechargePage() {
  const isOwner = useIsOwner()
  const billingVersion = useBillingVersion()
  const [refreshKey, setRefreshKey] = useState(0)
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState(DEFAULTS)
  const [context, setContext] = useState({ wallet: null, billing: null, defaultCard: null })
  const [errors, setErrors] = useState({})
  const [pending, setPending] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [orgId, setOrgId] = useState(null)
  // Inline payment-methods state. The auto-recharge page now lets users
  // manage their cards without leaving the page.
  const [cardsVm, setCardsVm] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [pendingRemove, setPendingRemove] = useState(null)

  useEffect(() => {
    if (!isOwner) return
    const id = getActiveOrgId()
    setOrgId(id)
    if (!id) return
    const cfg = getAutoRecharge(id) || DEFAULTS
    const wallet = getWallet(id)
    const billing = getActiveOrgBilling()
    const defaultCard = getDefaultCard(id)
    setSaved(cfg)
    setForm({
      enabled: !!cfg.enabled,
      thresholdUsd: Number(cfg.thresholdUsd || DEFAULTS.thresholdUsd),
      rechargeAmountUsd: Number(cfg.rechargeAmountUsd || DEFAULTS.rechargeAmountUsd),
      // Migrate legacy 'card_placeholder' to the actual default card id
      // when a default now exists; otherwise keep the placeholder string
      // so the disabled-when-empty UI stays in sync.
      paymentMethod:
        cfg.paymentMethod === 'wallet_credit'
          ? DEFAULTS.paymentMethod
          : cfg.paymentMethod === 'card_placeholder' && defaultCard
            ? defaultCard.id
            : cfg.paymentMethod || DEFAULTS.paymentMethod,
    })
    setContext({ wallet, billing, defaultCard })
    setDirty(false)
    setErrors({})
  }, [refreshKey, isOwner, billingVersion])

  // Load the inline payment-methods list whenever the user adds,
  // removes, or changes the default card. Triggers from
  // `billing:state-changed` events fired by the mutation helpers.
  useEffect(() => {
    if (!isOwner || !orgId) {
      setCardsVm(null)
      return
    }
    const v = getPaymentMethods(orgId)
    const defaultCard = getDefaultCard(orgId)
    const cards = (v.items || []).map((card) => ({
      ...card,
      usedBy: getCardUsedBy(orgId, card.id, {
        planLabelLookup: (t) => PLAN_TIER_LABEL[t] || t,
      }),
      isDefault: defaultCard && defaultCard.id === card.id,
    }))
    setCardsVm({ cards, defaultId: v.defaultId || null })
  }, [refreshKey, isOwner, billingVersion, orgId])

  const handleCardAdded = useCallback((card) => {
    setRefreshKey((k) => k + 1)
    toast.success(
      `Added ${CARD_BRANDS[card.brand]?.label || 'card'} ending in ${card.last4}.`,
    )
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('billing:state-changed'))
    }
  }, [])

  const handleSetCardDefault = useCallback((cardId) => {
    const result = setDefaultPaymentMethod(orgId, cardId)
    if (result.ok) {
      setRefreshKey((k) => k + 1)
      if (!result.unchanged) {
        toast.success('Default payment method updated.')
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('billing:state-changed'))
      }
    } else {
      toast.error('Could not update default. Try again.')
    }
  }, [orgId])

  const performCardRemove = useCallback(() => {
    if (!pendingRemove || !orgId) return
    const result = removePaymentMethod(orgId, pendingRemove.id)
    if (result.ok) {
      const wasDefault = result.removedDefault
      setPendingRemove(null)
      setRefreshKey((k) => k + 1)
      toast.success(
        wasDefault
          ? 'Removed default card. Auto Recharge is no longer bound to a card — re-enable it after adding a new one.'
          : 'Card removed.',
      )
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('billing:state-changed'))
      }
    } else {
      toast.error('Could not remove card. Try again.')
    }
  }, [pendingRemove, orgId])

  // Hoist all useMemo before any early returns - Rules of Hooks.
  const computed = useMemo(() => {
    const t = Number(form.thresholdUsd)
    const a = Number(form.rechargeAmountUsd)
    const e = {}
    if (form.enabled) {
      if (!Number.isFinite(t) || t < LIMITS.thresholdUsd.min) {
        e.thresholdUsd = `Minimum ${LIMITS.thresholdUsd.min}`
      } else if (t > LIMITS.thresholdUsd.max) {
        e.thresholdUsd = `Maximum ${LIMITS.thresholdUsd.max.toLocaleString()}`
      }
      if (!Number.isFinite(a) || a < LIMITS.rechargeAmountUsd.min) {
        e.rechargeAmountUsd = `Minimum ${LIMITS.rechargeAmountUsd.min}`
      } else if (a > LIMITS.rechargeAmountUsd.max) {
        e.rechargeAmountUsd = `Maximum ${LIMITS.rechargeAmountUsd.max.toLocaleString()}`
      }
      if (!e.thresholdUsd && !e.rechargeAmountUsd && t >= a) {
        e.rechargeAmountUsd = 'Recharge amount must be greater than threshold'
      }
    }
    return { errors: e, valid: Object.keys(e).length === 0 }
  }, [form, context?.wallet?.balance])

  const estimate = useMemo(() => {
    const wallet = context?.wallet?.balance || 0
    const t = Number(form.thresholdUsd)
    const a = Number(form.rechargeAmountUsd)
    return {
      thresholdUsd: t,
      rechargeToUsd: a,
      walletNowUsd: wallet,
      triggeredAt: wallet < t,
    }
  }, [context, form])

  // Hoisted before the early returns: Rules of Hooks.
  const sortedCards = useMemo(() => {
    if (!cardsVm) return []
    return [...cardsVm.cards].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1
      if (b.isDefault && !a.isDefault) return 1
      return (b.addedAt || '').localeCompare(a.addedAt || '')
    })
  }, [cardsVm])

  // Non-owner early return AFTER all hooks.
  if (!isOwner) return <RestrictedAccess />

  if (!saved) {
    return (
      <PageContainer>
        <PageHeader title="Auto Recharge" description="Loading..." />
      </PageContainer>
    )
  }

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (pending) return
    if (!computed.valid) {
      setErrors(computed.errors)
      if (form.enabled) {
        toast.error('Please fix the highlighted fields before saving.')
      }
      return
    }
    setPending(true)
    await new Promise((r) => setTimeout(r, 500))
    if (!orgId) return
    saveAutoRecharge(orgId, {
      enabled: form.enabled,
      thresholdUsd: Number(form.thresholdUsd),
      rechargeAmountUsd: Number(form.rechargeAmountUsd),
      paymentMethod: form.paymentMethod,
    })
    setPending(false)
    setDirty(false)
    setRefreshKey((k) => k + 1)
    toast.success(
      form.enabled
        ? 'Auto-recharge is now on.'
        : 'Auto-recharge is off. Your settings were saved.',
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="Auto Recharge"
        description="Keep your wallet topped up automatically. When the balance drops below a threshold, we add credit and re-trigger."
      >
        <PersonaSwitcher />
      </PageHeader>

      <div className="space-y-6">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Master toggle */}
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className={[
                    'flex h-10 w-10 items-center justify-center rounded-xl shrink-0 transition',
                    form.enabled
                      ? 'bg-emerald-100 dark:bg-emerald-500/15'
                      : 'bg-slate-100 dark:bg-slate-800',
                  ].join(' ')}
                >
                  <RefreshCw
                    className={[
                      'h-5 w-5 transition',
                      form.enabled
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400',
                    ].join(' ')}
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Auto-recharge
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {form.enabled ? (
                      <>
                        When your wallet drops below{' '}
                        <strong className="text-slate-900 dark:text-white">
                          ${form.thresholdUsd}
                        </strong>
                        , we add{' '}
                        <strong className="text-slate-900 dark:text-white">
                          ${form.rechargeAmountUsd}
                        </strong>{' '}
                        from your{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {context?.defaultCard
                            ? `${CARD_BRANDS[context.defaultCard.brand]?.label || 'card'} •••• ${context.defaultCard.last4}`
                            : 'card on file'}
                        </strong>
                        .
                      </>
                    ) : (
                      <>
                        Turn on to keep your wallet topped up automatically.
                        When your balance drops below a threshold, we add
                        credit from your card on file.
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setField('enabled', !!v)}
                aria-label="Enable auto-recharge"
              />
            </div>
          </Card>

          {/* Trigger & amount + estimate preview. The standalone "Payment
              method" picker card was removed because auto-recharge can
              only pull from a card, and the card info already appears in
              the master toggle description and the bottom "Payment
              methods" sub-card. The estimate is nested inside this card
              (with its own bordered inner block) so it reads as part of
              the trigger settings rather than a floating callout that
              visually merges with the page background. */}
          <Card className={['p-6 space-y-6', !form.enabled && 'opacity-60 pointer-events-none'].filter(Boolean).join(' ')}>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Trigger & amount
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                The trigger fires when balance ≤ threshold. The recharge tops up
                to (or by) the amount you specify.
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <FieldRow
                  label="Trigger threshold"
                  htmlFor="threshold"
                  required={form.enabled}
                  error={errors.thresholdUsd}
                  helper="When wallet balance drops below this, we auto-reload."
                >
                  <div className="relative">
                    <CircleDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      id="threshold"
                      type="number"
                      inputMode="decimal"
                      min={LIMITS.thresholdUsd.min}
                      max={LIMITS.thresholdUsd.max}
                      step={LIMITS.thresholdUsd.step}
                      value={form.thresholdUsd}
                      onChange={(e) => setField('thresholdUsd', e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </FieldRow>

                <FieldRow
                  label="Recharge amount"
                  htmlFor="amount"
                  required={form.enabled}
                  error={errors.rechargeAmountUsd}
                  helper="Must be greater than the threshold."
                >
                  <div className="relative">
                    <ArrowDownToLine className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      id="amount"
                      type="number"
                      inputMode="decimal"
                      min={LIMITS.rechargeAmountUsd.min}
                      max={LIMITS.rechargeAmountUsd.max}
                      step={LIMITS.rechargeAmountUsd.step}
                      value={form.rechargeAmountUsd}
                      onChange={(e) => setField('rechargeAmountUsd', e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </FieldRow>
              </div>
            </div>

            {form.enabled && estimate && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  What happens next
                </div>
                <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <li>
                    When your balance drops below{' '}
                    <strong className="text-slate-900 dark:text-white">
                      ${estimate.thresholdUsd}
                    </strong>
                    , we will add{' '}
                    <strong className="text-slate-900 dark:text-white">
                      ${form.rechargeAmountUsd}
                    </strong>{' '}
                    from your{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {context?.defaultCard
                        ? `${CARD_BRANDS[context.defaultCard.brand]?.label || 'card'} •••• ${context.defaultCard.last4}`
                        : 'card on file'}
                    </strong>
                    .
                  </li>
                  {estimate.triggeredAt ? (
                    <li className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>
                        Your current balance (${estimate.walletNowUsd.toFixed(2)}) is
                        below the threshold — the trigger will fire on the next
                        scheduled check.
                      </span>
                    </li>
                  ) : (
                    <li>
                      Current balance{' '}
                      <strong className="text-slate-900 dark:text-white">
                        ${estimate.walletNowUsd.toFixed(2)}
                      </strong>{' '}
                      is above the threshold, so the trigger won't fire until
                      recurring charges draw it down.
                    </li>
                  )}
                </ul>
              </div>
            )}

            {!context?.defaultCard && form.enabled && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  No card on file. Add a card below before turning
                  auto-recharge on.
                </div>
              </div>
            )}
          </Card>

          {/* Save row */}
          <Card className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/30">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {form.enabled
                ? 'Auto-recharge will run on the next scheduled check.'
                : 'Auto-recharge is off. Save to apply.'}
            </div>
            <div className="flex items-center gap-2">
              <Button
                asChild
                type="button"
                variant="outline"
              >
                <Link href="/billing/wallet">
                  View wallet
                </Link>
              </Button>
              <Button type="submit" disabled={pending || !dirty}>
                <Save className="h-4 w-4" />
                {pending ? 'Saving...' : 'Save auto-recharge'}
              </Button>
            </div>
          </Card>
        </form>

        {/* Inline payment methods — users see every saved card, set the
            default, add a new card, and remove a card directly on the
            Auto Recharge page. */}
        <Card className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 bg-slate-100 dark:bg-slate-800">
                <CreditCard className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Payment methods
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Cards on file for Auto Recharge top-ups and subscription renewals. The first card is the default.
                </p>
              </div>
            </div>
            {sortedCards.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(true)}
                data-testid="ar-add-card"
              >
                <Plus className="h-4 w-4" />
                Add card
              </Button>
            )}
          </div>

          {sortedCards.length === 0 ? (
            <PmEmptyState onAdd={() => setAddOpen(true)} />
          ) : (
            <div className="space-y-3" data-testid="ar-cards-list">
              {sortedCards.map((card) => (
                <PaymentMethodCard
                  key={card.id}
                  card={card}
                  isDefault={card.isDefault}
                  usedBy={card.usedBy}
                  onSetDefault={handleSetCardDefault}
                  onRemove={(c) => setPendingRemove(c)}
                />
              ))}
            </div>
          )}

          <p className="flex items-start gap-2 text-2xs text-slate-500 dark:text-slate-400 pt-1">
            Card details are tokenized and never stored in full. We retain
            last-4, brand, expiry, holder name, and a billing email.
          </p>
        </Card>
      </div>

      {/* Add payment method dialog — same component as the sub-page uses */}
      <AddPaymentMethodDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        orgId={orgId}
        hasExistingCards={sortedCards.length > 0}
        onAdded={handleCardAdded}
      />

      {/* Confirm before removing a card; warn about AR if it's the default */}
      <ConfirmDialog
        open={!!pendingRemove}
        onOpenChange={(o) => {
          if (!o) setPendingRemove(null)
        }}
        title={pendingRemove?.isDefault ? 'Remove default card?' : 'Remove this card?'}
        description={
          pendingRemove?.isDefault
            ? `${CARD_BRANDS[pendingRemove?.brand]?.label || 'Card'} ending in ${pendingRemove?.last4} is your default. Removing it changes what renewals charge.`
            : `${CARD_BRANDS[pendingRemove?.brand]?.label || 'Card'} ending in ${pendingRemove?.last4} will be removed from your account. You can re-add it later.`
        }
        variant="destructive"
        icon={<CreditCard className="h-5 w-5" />}
        confirmText="Remove card"
        cancelText="Keep card"
        onConfirm={performCardRemove}
      >
        {pendingRemove?.isDefault && (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              This card is currently bound to{' '}
              <strong>Auto Recharge</strong>. Removing it will{' '}
              <strong>disable Auto Recharge</strong> until you add another
              card and re-enable the rule.
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Auto Recharge only works with a saved card, so there is no
              other payment source to fall back to.
            </p>
          </div>
        )}
      </ConfirmDialog>
    </PageContainer>
  )
}

function PmEmptyState({ onAdd }) {
  return (
    <div
      className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 px-5 py-8 text-center"
      data-testid="ar-cards-empty"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-500/15 ring-1 ring-indigo-200 dark:ring-indigo-500/30">
        <Inbox className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
        No payment methods on file
      </h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
        Add a card so we can charge renewals and Auto Recharge top-ups.
      </p>
      <Button onClick={onAdd} className="mt-4" data-testid="ar-empty-add-card">
        <Plus className="h-4 w-4" />
        Add a card
      </Button>
    </div>
  )
}

