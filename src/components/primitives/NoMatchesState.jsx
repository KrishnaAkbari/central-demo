/**
 * NoMatchesState — the "your filters returned zero" empty state used by
 * /members, /organizations, /audit. Extracted so the copy and CTA shape
 * stay consistent across list pages.
 *
 * Usage:
 *   <NoMatchesState
 *     title="No organizations match your filters"
 *     description="Try a different search or role filter."
 *     onClear={clearFilters}
 *   />
 */

import React from 'react'
import { Search, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function NoMatchesState({
  icon: Icon = Search,
  title = 'No results match your filters',
  description = 'Try a wider search or remove filters.',
  ctaLabel = 'Clear filters',
  onClear,
  className,
}) {
  return (
    <Card className={'p-10 text-center border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 ' + (className || '')}>
      <Icon className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
      <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
      {onClear && (
        <Button variant="outline" size="sm" onClick={onClear} className="mt-4">
          <X className="h-4 w-4 mr-1" />
          {ctaLabel}
        </Button>
      )}
    </Card>
  )
}
