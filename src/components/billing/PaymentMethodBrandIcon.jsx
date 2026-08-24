// Brand icon for a saved card. Renders a stylized 32x20 chip showing the
// network mark in a gradient that matches Stripe / Adyen / Paddle card
// iconography. Unknown brand renders a generic card outline. This is the
// universal pattern Mobbin, shadcn blocks, and JustFigma recommend for
// saved-methods lists: one icon at this size per row.

import { cn } from '@/lib/utils'
import { CARD_BRANDS } from '@/services/billingPaymentMethodsApi'

export function PaymentMethodBrandIcon({ brand, className }) {
  const safe = CARD_BRANDS[brand] || CARD_BRANDS.unknown
  const text = safe.textOnCard
  return (
    <div
      className={cn(
        'flex h-5 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-[9px] font-bold tracking-tight text-white shadow-sm ring-1 ring-black/10',
        safe.gradient,
        className,
      )}
      aria-hidden="true"
      data-brand={brand}
    >
      <span className="drop-shadow-sm">{text}</span>
    </div>
  )
}
