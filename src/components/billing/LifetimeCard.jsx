'use client'

import { Check, Crown, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// LifetimeCard — single one-time-purchase deal. Similar to PlanCard but:
//   - price is one-time, not monthly
//   - state is 'available' (buy) / 'current' (own it) / 'disabled' (lower
//     tier when you already own a higher one / cannot downgrade)
//   - "Buy for $X" CTA instead of "Choose this plan"
//
// topTier deals (Business Lifetime) show a Crown icon and an "Upgrade
// unavailable — top tier" badge when the user is already on a lifetime
// (because nothing higher exists).
export function LifetimeCard({
  tier,
  state = 'available',
  disabledReason = null,
  onPurchase,
  isTopTier = false,
}) {
  const isCurrent = state === 'current'
  const isDisabled = state === 'disabled'
  const noCta = isCurrent || isDisabled

  return (
    <Card
      className={cn(
        'relative flex flex-col p-5 transition-all',
        isCurrent && 'border-amber-300 dark:border-amber-500/60 ring-1 ring-amber-100 dark:ring-amber-500/20',
        !isCurrent && !isDisabled && 'hover:border-slate-300 dark:hover:border-slate-700',
        isDisabled && 'opacity-90',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          {isTopTier && <Crown className="h-4 w-4 text-amber-500 dark:text-amber-400" />}
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {tier.name}
          </h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isCurrent && (
            <Badge variant="warning">Your lifetime deal</Badge>
          )}
          {isTopTier && !isCurrent && (
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3 w-3" />
              Top tier
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[24px] sm:text-[24px] font-bold text-slate-900 dark:text-white">
          ${tier.priceUsd.toLocaleString()}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          one-time
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
        {tier.serverLimit === null
          ? 'Unlimited servers, forever'
          : `${tier.serverLimit} servers, forever`}
        {tier.extraSlotPriceUsd && (
          <span className="ml-2 text-slate-500">· + ${tier.extraSlotPriceUsd}/extra slot</span>
        )}
      </p>

      {tier.features?.length > 0 && (
        <ul className="mt-4 space-y-2 flex-1">
          {tier.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500 dark:text-emerald-400" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {isDisabled && disabledReason && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs leading-snug text-amber-800 dark:text-amber-200">
          <span className="font-medium">{disabledReason}</span>
        </div>
      )}

      {!noCta && (
        <Button
          type="button"
          className="mt-5 w-full"
          onClick={() => onPurchase && onPurchase(tier.id)}
        >
          Buy for ${tier.priceUsd.toLocaleString()}
        </Button>
      )}
      {isCurrent && (
        <div className="mt-5 w-full text-center text-xs text-slate-500 dark:text-slate-400 py-2.5 rounded-md border border-dashed border-amber-200 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/5">
          You own this lifetime deal
        </div>
      )}
    </Card>
  )
}