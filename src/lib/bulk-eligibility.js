// Bulk-action eligibility — centralizes "can the current user perform
// this action on every row in the current selection?" so any list page
// with a BulkActionTray can enable or disable the action button with a
// context-rich tooltip.
//
// Why this lives here instead of inline in the tray:
//   * One source of truth for "what does the disabled tooltip say?"
//   * Adding a future bulk action (Delete, Tag, Move) is one more entry
//     in BULK_ACTIONS below — no tray code changes.
//   * Pure functions are easy to unit-test without rendering React.
//
// Each action has:
//   verb — human verb for the disabled tooltip, e.g.
//          "You can only {verb} servers you own · N of M eligible".
//   rowAllows(row, currentUser) → boolean — per-row gate.
//   disabledReason — optional string. When set, the action is always
//                    disabled (regardless of rowAllows) and the reason
//                    is shown verbatim in the tray tooltip. Use this
//                    for actions that are intentionally not wired up
//                    yet (e.g. bulk restart on a prototype that only
//                    has a single-server disconnect). It tells the
//                    user "this button exists, here's why it's off"
//                    instead of either hiding the button entirely or
//                    showing the generic "Unknown action" reason.
//
// An action is enabled iff every selected row passes its gate AND the
// action has no disabledReason. The "eligibleCount" is reported
// alongside so the tray can show how many of the selected rows would
// actually be touched.

function actionVerb(actionId) {
  switch (actionId) {
    case 'shareServerAccess': return 'share access to'
    case 'deleteServers':      return 'delete'
    case 'tagServers':         return 'tag'
    case 'moveServers':        return 'move'
    case 'removeMembers':      return 'remove'
    case 'bulkDisconnectAccounts': return 'disconnect'
    default:                   return 'act on'
  }
}

// Per-row gates. Each gate answers "does this row allow the action
// for the current user?" Return false for safety unless the rule is
// explicitly added — no implicit allow.
//
// currentUser shape (built by callers; never trust call-site names):
//   { isOwner: boolean, canManageServers: boolean, canManageMembers: boolean }
//   - isOwner: org-level owner (see useIsOwner). Required by
//     assertCanManageServerAccess, so share-access is owner-only.
//   - canManageServers: org-level "organization.servers.manage"
//     permission. Owner and admins have it; required for delete/tag.
//   - canManageMembers: org-level "organization.members.manage"
//     permission. Same gate that enables the per-row Remove / Cancel
//     invite actions on /members; bulk action uses it too.
const BULK_ACTIONS = {
  shareServerAccess: {
    verb: 'share access to',
    rowAllows: (_row, currentUser) => !!currentUser?.isOwner,
  },
  deleteServers: {
    verb: 'delete',
    rowAllows: (_row, currentUser) => !!currentUser?.canManageServers,
  },
  // Bulk restart — not wired up in this prototype. The single-server
  // ServerActionsMenu also doesn't expose a restart item (only View /
  // Rename / Disconnect), so adding a bulk action would imply parity
  // that doesn't exist. The button is rendered disabled with a clear
  // reason so users can see the affordance is on the roadmap.
  restartServers: {
    verb: 'restart',
    rowAllows: () => false,
    disabledReason: 'Bulk restart is not available in this prototype yet',
  },
  // Bulk tagging — same story. The demo has no tag concept in its
  // schema (cp_servers has no tags field), so this stays disabled with
  // a clear reason.
  tagServers: {
    verb: 'tag',
    rowAllows: () => false,
    disabledReason: 'Bulk tagging is not available in this prototype yet',
  },
  moveServers: {
    verb: 'move',
    rowAllows: (_row, currentUser) => !!currentUser?.canManageServers,
  },
  // Bulk disconnect on /integrations — pre-flight check separates
  // accounts with servers attached (skipped, see openBulkDisconnect)
  // from free-to-drop accounts. Per-row gate mirrors the canManage
  // permission (same as the per-row AccountActionsMenu disconnect).
  bulkDisconnectAccounts: {
    verb: 'disconnect',
    rowAllows: (_row, currentUser) => !!currentUser?.canManage,
  },
  // Bulk member removal covers both active rows (kind='active') and
  // invited rows (kind='invited'): the tray calls removeOrgMember for
  // active ids and cancelOrgInvitation for invite emails in one go.
  // Per-row gate returns false when the user lacks manage permission
  // OR when the row is the org owner (owner is never removable —
  // backend enforces; we surface it via tooltip).
  removeMembers: {
    verb: 'remove',
    rowAllows: (row, currentUser) => {
      if (!currentUser?.canManageMembers) return false
      if (row?.isOwner) return false
      // Active rows where rowId === null are also owners in the mock.
      if (row?.roleId === null) return false
      return true
    },
  },
}

// Compute eligibility for one action against one selection. Pure.
//   options: {
//     actionId: string,                  // one of BULK_ACTIONS keys
//     selection: row[],                  // rows currently in the tray
//     currentUser: { isOwner, canManageServers, canManageMembers }
//   }
//
// Returns: { enabled, eligibleCount, total, verb, reason }
//   enabled       — true iff selection is non-empty AND every row passes
//   eligibleCount — number of rows that pass the gate
//   total         — total rows in the selection (== enabled's precondition)
//   verb          — human verb for copy reuse (e.g. "{verb} servers")
//   reason        — null when enabled, otherwise a tooltip-ready string
export function bulkActionEligibility({ actionId, selection, currentUser }) {
  const total = Array.isArray(selection) ? selection.length : 0
  const rule = BULK_ACTIONS[actionId]
  if (!rule) {
    return {
      enabled: false,
      eligibleCount: 0,
      total,
      verb: actionVerb(actionId),
      reason: 'Unknown action',
    }
  }
  // Always-disabled actions (placeholder for not-yet-implemented
  // features) short-circuit before the row gate runs. eligibleCount
  // stays 0 because no row passes; the disabledReason is returned
  // verbatim so the tooltip tells the user exactly what's missing.
  if (rule.disabledReason) {
    return {
      enabled: false,
      eligibleCount: 0,
      total,
      verb: rule.verb,
      reason: rule.disabledReason,
    }
  }
  if (total === 0) {
    return { enabled: false, eligibleCount: 0, total: 0, verb: rule.verb, reason: null }
  }
  let eligibleCount = 0
  for (const row of selection) {
    if (rule.rowAllows(row, currentUser)) eligibleCount++
  }
  const allEligible = eligibleCount === total
  return {
    enabled: allEligible,
    eligibleCount,
    total,
    verb: rule.verb,
    reason: allEligible
      ? null
      : `You can only ${rule.verb} servers you own · ${eligibleCount} of ${total} eligible`,
  }
}

// Convenience for callers that want the verb outside an eligibility
// check (e.g. "Delete N of M servers" copy). Returns 'act on' for
// unknown actions.
export function bulkActionVerb(actionId) {
  const rule = BULK_ACTIONS[actionId]
  return rule ? rule.verb : actionVerb(actionId)
}
