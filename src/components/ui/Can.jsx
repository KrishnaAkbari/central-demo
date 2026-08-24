'use client'

import { useCan } from '@/hooks/useCan'
import { cn } from '@/utils'

// Lightweight <Can> wrapper. Two render modes:
//
//   <Can do="server.manage">…</Can>                        // shows when allowed
//   <Can do="server.manage" fallback={…} hideWhenDenied>…</Can>
//
// By default, when the permission is missing the children are rendered
// as disabled (with a tooltip "You don't have permission") rather than
// hidden, so page layout stays stable. Pass `hideWhenDenied` to remove
// them entirely instead — useful for primary CTAs that should not
// appear at all for view-only users.
export function Can({ do: permissionId, fallback = null, hideWhenDenied = false, children, className }) {
  const allowed = useCan(permissionId)

  if (allowed) return children

  if (hideWhenDenied) return fallback

  // Disabled render: wrap children in a span with title + disabled
  // cursor. Children are expected to be a single button or interactive
  // element — callers control disabled styling themselves via className.
  return (
    <span
      className={cn('inline-flex cursor-not-allowed opacity-50', className)}
      title="You don't have permission"
    >
      {children}
    </span>
  )
}