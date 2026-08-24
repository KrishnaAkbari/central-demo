// One row of the Saved payment methods list. Layout matches the universal
// pattern (Stripe / Vercel / Linear / Mobbin / JustFigma):
//
//   [brand-icon] Card name •••• 4242     [Default]  [Used by ...]
//                Exp 08/27 · cardholder    expires soon · [Set default] [Remove]

import {
  Star,
  Trash2,
  AlertTriangle,
  CircleCheck,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { PaymentMethodBrandIcon } from './PaymentMethodBrandIcon'

// Months left until a card expires. Negative means already expired.
// <60 = "expires soon" inline warning.
function monthsUntil(year, month /* 1-12 */) {
  const now = new Date()
  const expires = new Date(year, month, 1) // first of NEXT month
  // (the card is good through the LAST day of month)
  const months =
    (expires.getFullYear() - now.getFullYear()) * 12 +
    (expires.getMonth() - now.getMonth())
  return months - 1 // last day of `month` is `months - 1` full months away
}

const MS_PER_DAY = 86400000
function daysUntil(year, month, day = 0) {
  const last = new Date(year, month, 0).getTime() // last day of month
  return Math.ceil((last - Date.now()) / MS_PER_DAY)
}

export function PaymentMethodCard({
  card,
  isDefault,
  usedBy,
  onSetDefault,
  onRemove,
  // When true, hide action buttons (used in summary views where this card
  // is reference-only, not directly editable).
  readOnly = false,
}) {
  const last4 = card.last4
  const monthsLeft = monthsUntil(card.expYear, card.expMonth)
  const daysLeft = daysUntil(card.expYear, card.expMonth)
  const isExpired = monthsLeft < 0
  const isSoon = !isExpired && monthsLeft <= 2

  const expiryLabel = `Exp ${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`

  return (
    <Card
      className={cn(
        'p-4 sm:p-5 transition-all',
        isDefault && 'ring-1 ring-indigo-200 dark:ring-indigo-500/30 bg-indigo-50/30 dark:bg-indigo-500/[0.04]',
      )}
      data-testid={`payment-method-card-${card.id}`}
      data-default={isDefault ? 'true' : 'false'}
    >
      <div className="flex items-start gap-4">
        <PaymentMethodBrandIcon brand={card.brand} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white"
              data-testid={`payment-method-last4-${card.id}`}
            >
              •••• {last4}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {expiryLabel}
            </span>
            {isDefault && (
              <span
                data-testid={`payment-method-default-badge-${card.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-500/15 px-2 py-0.5 text-xxs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300"
              >
                <Star className="h-2.5 w-2.5 fill-current" />
                Default
              </span>
            )}
            {isExpired && (
              <span
                data-testid={`payment-method-expired-badge-${card.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-500/15 px-2 py-0.5 text-xxs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300"
              >
                Expired
              </span>
            )}
            {!isExpired && isSoon && (
              <span
                data-testid={`payment-method-soon-badge-${card.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 text-xxs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300"
                title={`Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                Expires in {daysLeft}d
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {card.holderName}
            </span>
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
            <span>{card.billingEmail}</span>
          </p>

          {usedBy && (
            <p
              className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
              data-testid={`payment-method-usedby-${card.id}`}
              data-usedby-kind={usedBy.kind}
            >
              <Lock className="h-3 w-3 text-slate-400" />
              <span>
                Used by{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {usedBy.label}
                </span>
              </span>
            </p>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center gap-1.5 shrink-0">
            {!isDefault && onSetDefault && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetDefault(card.id)}
                data-testid={`payment-method-set-default-${card.id}`}
              >
                <CircleCheck className="h-3.5 w-3.5" />
                Set default
              </Button>
            )}
            {onRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(card)}
                className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                data-testid={`payment-method-remove-${card.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:ml-1">Remove</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

export function PaymentMethodCardSkeleton() {
  return (
    <Card className="p-4 sm:p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="h-5 w-8 rounded-md bg-slate-200 dark:bg-slate-700 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-64 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    </Card>
  )
}
