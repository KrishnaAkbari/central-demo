// Mock "Add card" flow. Strictly tokenized: even though this is a mock
// build we never persist the full PAN. The form collects the number,
// detects the brand from BIN, validates via Luhn, then strips the card
// number down to last4 on submit (full PAN leaves memory immediately).
//
// Validation order: collect ALL errors before deciding to bail (per
// Krishna's R15 rule — sequential early returns hide later errors).
//
// CVC length is brand-aware (4 for Amex, 3 otherwise).
//
// Inline validation: errors clear as soon as the user starts typing
// again (clear-on-type, per R6/R7).

import { useEffect, useMemo, useState } from 'react'
import {
  CreditCard,
  CheckCircle2,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldRow } from '@/components/ui/field'
import {
  addPaymentMethod,
  detectCardBrand,
  expectedCvcLength,
  isValidExpiry,
  isValidLuhn,
  CARD_BRANDS,
} from '@/services/billingPaymentMethodsApi'
import { PaymentMethodBrandIcon } from './PaymentMethodBrandIcon'
import { cn } from '@/lib/utils'

function stripToDigits(s) {
  return String(s || '').replace(/\D/g, '')
}

function formatCardNumber(s) {
  const digits = stripToDigits(s).slice(0, 19)
  // Group 4-4-4-4 for most brands, 4-6-5 for Amex.
  const brand = detectCardBrand(digits)
  if (brand === 'amex') {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)]
      .filter(Boolean)
      .join(' ')
  }
  return digits.match(/.{1,4}/g)?.join(' ') || digits
}

// The storage shape needs an `id`; the API assigns one but for the loading
// state we know the brand/last4 because the form has them. We pass the
// form's view data into addPaymentMethod which validates and returns the
// new card.
const INITIAL = {
  cardNumber: '',
  expMonth: '',
  expYear: '',
  cvc: '',
  holderName: '',
  billingEmail: '',
  makeDefault: true,
}

export function AddPaymentMethodDialog({
  open,
  onOpenChange,
  orgId,
  hasExistingCards = false,
  defaultBillingEmail = '',
  onAdded,
}) {
  const [form, setForm] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [pending, setPending] = useState(false)
  const [generalError, setGeneralError] = useState(null)

  // Reset form when dialog re-opens.
  useEffect(() => {
    if (open) {
      setForm({ ...INITIAL, billingEmail: defaultBillingEmail })
      setErrors({})
      setPending(false)
      setGeneralError(null)
    }
  }, [open, defaultBillingEmail])

  const detectedBrand = useMemo(() => detectCardBrand(form.cardNumber), [
    form.cardNumber,
  ])
  const cvcLen = expectedCvcLength(detectedBrand)
  const brandMeta = CARD_BRANDS[detectedBrand] || CARD_BRANDS.unknown

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
    // Clear error for this field on type (R6/R7).
    setErrors((prev) => {
      if (!prev[name]) return prev
      const { [name]: _drop, ...rest } = prev
      return rest
    })
    setGeneralError(null)
  }

  function validateAll() {
    const errs = {}

    const normalizedNumber = stripToDigits(form.cardNumber)
    if (!normalizedNumber) {
      errs.cardNumber = 'Card number is required.'
    } else if (normalizedNumber.length < 12) {
      errs.cardNumber = 'Card number is too short.'
    } else if (!isValidLuhn(normalizedNumber)) {
      errs.cardNumber = 'Card number is invalid.'
    } else if (detectedBrand === 'unknown') {
      errs.cardNumber = 'Unsupported card brand. Try Visa/Mastercard/Amex.'
    }

    if (!form.expMonth) errs.expMonth = 'Required.'
    else if (Number(form.expMonth) < 1 || Number(form.expMonth) > 12) {
      errs.expMonth = 'Month must be 01–12.'
    }
    if (!form.expYear) errs.expYear = 'Required.'
    else if (form.expYear.length < 2 || form.expYear.length > 4) {
      errs.expYear = 'Use 2 or 4 digits.'
    }
    if (
      !errs.expMonth &&
      !errs.expYear &&
      !isValidExpiry(Number(form.expMonth), Number(form.expYear))
    ) {
      errs.expiry = 'Card has expired or expiry is in the past.'
    }

    if (!form.cvc) errs.cvc = 'Required.'
    else if (form.cvc.length !== cvcLen) {
      errs.cvc =
        cvcLen === 4
          ? 'Amex CVC must be 4 digits.'
          : 'CVC must be 3 digits.'
    }

    if (!form.holderName.trim()) errs.holderName = 'Cardholder name is required.'
    if (!form.billingEmail.trim()) errs.billingEmail = 'Required.'
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.billingEmail.trim())) {
      errs.billingEmail = 'Enter a valid email.'
    }

    return errs
  }

  async function handleSubmit(e) {
    e?.preventDefault?.()
    if (pending) return
    const collected = validateAll()
    if (Object.keys(collected).length > 0) {
      setErrors(collected)
      return
    }
    setErrors({})
    setPending(true)
    // Simulate a network round-trip to the mock processor. Failure rate is
    // intentionally 0 in mock mode — the form gate is the Luhn check.
    await new Promise((r) => setTimeout(r, 600))
    try {
      const card = addPaymentMethod(orgId, {
        cardNumber: stripToDigits(form.cardNumber),
        expMonth: Number(form.expMonth),
        expYear: Number(form.expYear),
        cvc: form.cvc.trim(),
        holderName: form.holderName.trim(),
        billingEmail: form.billingEmail.trim(),
        makeDefault: form.makeDefault,
      })
      onAdded?.(card)
      onOpenChange(false)
    } catch (err) {
      setGeneralError(err?.message || 'Could not save card. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-500/15">
                <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <DialogTitle>Add payment method</DialogTitle>
                <DialogDescription>
                  Add a card on file. Card details are tokenized — we never
                  store the full number.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 pb-2 space-y-4">
            {generalError && (
              <div className="rounded-md border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                {generalError}
              </div>
            )}

            <FieldRow
              label="Card number"
              htmlFor="pm-cardNumber"
              error={errors.cardNumber}
            >
              <div className="relative">
                <Input
                  id="pm-cardNumber"
                  name="cardNumber"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder={
                    detectedBrand === 'amex'
                      ? '3782 822463 10005'
                      : detectedBrand === 'mastercard'
                      ? '5555 5555 5555 4444'
                      : '4242 4242 4242 4242'
                  }
                  value={formatCardNumber(form.cardNumber)}
                  onChange={(e) => setField('cardNumber', e.target.value)}
                  maxLength={
                    detectedBrand === 'amex' ? 17 : 19 /* grouped digits */
                  }
                  className={cn(
                    'pr-12',
                    errors.cardNumber &&
                      'border-rose-400 dark:border-rose-500 focus-visible:ring-rose-400/40',
                  )}
                  aria-invalid={!!errors.cardNumber}
                  data-testid="pm-input-cardnumber"
                />
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                  <PaymentMethodBrandIcon brand={detectedBrand} />
                </div>
              </div>
              {detectedBrand !== 'unknown' && !errors.cardNumber && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {brandMeta.label} detected
                </p>
              )}
            </FieldRow>

            <div className="grid grid-cols-3 gap-3">
              <FieldRow label="Month" htmlFor="pm-expMonth" error={errors.expMonth || errors.expiry}>
                <Input
                  id="pm-expMonth"
                  name="expMonth"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                  value={form.expMonth}
                  onChange={(e) => setField('expMonth', stripToDigits(e.target.value).slice(0, 2))}
                  aria-invalid={!!(errors.expMonth || errors.expiry)}
                  data-testid="pm-input-expmonth"
                />
              </FieldRow>
              <FieldRow label="Year" htmlFor="pm-expYear" error={errors.expYear || errors.expiry}>
                <Input
                  id="pm-expYear"
                  name="expYear"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="YYYY"
                  value={form.expYear}
                  onChange={(e) => setField('expYear', stripToDigits(e.target.value).slice(0, 4))}
                  aria-invalid={!!(errors.expYear || errors.expiry)}
                  data-testid="pm-input-expyear"
                />
              </FieldRow>
              <FieldRow
                label="CVC"
                htmlFor="pm-cvc"
                error={errors.cvc}
                helper={`${cvcLen} digits`}
              >
                <Input
                  id="pm-cvc"
                  name="cvc"
                  inputMode="numeric"
                  maxLength={cvcLen}
                  placeholder={'•'.repeat(cvcLen)}
                  value={form.cvc}
                  onChange={(e) => setField('cvc', stripToDigits(e.target.value).slice(0, cvcLen))}
                  aria-invalid={!!errors.cvc}
                  data-testid="pm-input-cvc"
                />
              </FieldRow>
            </div>

            <FieldRow
              label="Name on card"
              htmlFor="pm-holderName"
              error={errors.holderName}
            >
              <Input
                id="pm-holderName"
                name="holderName"
                autoComplete="cc-name"
                placeholder="Cardholder name"
                value={form.holderName}
                onChange={(e) => setField('holderName', e.target.value)}
                aria-invalid={!!errors.holderName}
                data-testid="pm-input-holdername"
              />
            </FieldRow>

            <FieldRow
              label="Billing email"
              htmlFor="pm-billingEmail"
              error={errors.billingEmail}
              helper="Receipts and renewal notices will be sent here."
            >
              <Input
                id="pm-billingEmail"
                name="billingEmail"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={form.billingEmail}
                onChange={(e) => setField('billingEmail', e.target.value)}
                aria-invalid={!!errors.billingEmail}
                data-testid="pm-input-billingemail"
              />
            </FieldRow>

            <label className="flex items-start gap-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-3 cursor-pointer">
              <Checkbox
                checked={form.makeDefault}
                onCheckedChange={(v) => setField('makeDefault', !!v)}
                disabled={pending}
                data-testid="pm-input-makedefault"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-900 dark:text-white">
                  Set as default payment method
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {hasExistingCards
                    ? 'Renews, Auto Recharge, and one-time charges will use this card.'
                    : 'This will be the first card on file — it will be used by default.'}
                </span>
              </span>
            </label>

            <p className="flex items-start gap-1.5 text-2xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
              <span>
                We tokenize and discard the full card number. Only last-4,
                brand, and expiry are saved — never the CVC.
              </span>
            </p>
          </div>

          <DialogFooter className="px-6 pb-6 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              data-testid="pm-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} data-testid="pm-submit">
              {pending ? (
                'Saving…'
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Add card
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
