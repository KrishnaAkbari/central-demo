// Standalone test for src/lib/bulk-eligibility.js. Run with:
//   node scripts/test-bulk-eligibility.mjs
//
// No test framework is configured for the project — this is a tiny
// ad-hoc verifier that exercises the pure eligibility helper. Add
// more cases here when new bulk actions are introduced.
//
// Each test prints PASS/FAIL with the expected vs actual values so a
// regression is obvious from the output. Exit code 0 on success, 1
// on any failure — so this is also CI-runnable.

import {
  bulkActionEligibility,
  bulkActionVerb,
} from '../src/lib/bulk-eligibility.js'

let failures = 0
const assertEq = (label, actual, expected) => {
  const ok = actual === expected
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  actual=${JSON.stringify(actual)}  expected=${JSON.stringify(expected)}`)
  if (!ok) failures++
}

const owner = { isOwner: true, canManageServers: true }
const admin = { isOwner: false, canManageServers: true }
const member = { isOwner: false, canManageServers: false }

const srv1 = { id: 's1', name: 'one' }
const srv2 = { id: 's2', name: 'two' }
const srv3 = { id: 's3', name: 'three' }

// --- shareServerAccess ---

// Empty selection — always disabled, no reason.
{
  const r = bulkActionEligibility({ actionId: 'shareServerAccess', selection: [], currentUser: owner })
  assertEq('share: empty selection disabled', r.enabled, false)
  assertEq('share: empty selection has null reason', r.reason, null)
  assertEq('share: empty selection total=0', r.total, 0)
}

// Owner + selection — enabled.
{
  const r = bulkActionEligibility({
    actionId: 'shareServerAccess',
    selection: [srv1, srv2, srv3],
    currentUser: owner,
  })
  assertEq('share: owner + 3 rows enabled', r.enabled, true)
  assertEq('share: owner + 3 rows reason null', r.reason, null)
  assertEq('share: owner + 3 rows eligibleCount', r.eligibleCount, 3)
  assertEq('share: owner + 3 rows total', r.total, 3)
}

// Non-owner + selection — disabled, tooltip mentions eligibility gap.
{
  const r = bulkActionEligibility({
    actionId: 'shareServerAccess',
    selection: [srv1, srv2, srv3],
    currentUser: admin,
  })
  assertEq('share: non-owner disabled', r.enabled, false)
  assertEq('share: non-owner eligibleCount=0', r.eligibleCount, 0)
  assertEq(
    'share: non-owner tooltip wording',
    r.reason,
    'You can only share access to servers you own · 0 of 3 eligible',
  )
}

// Member — also disabled.
{
  const r = bulkActionEligibility({
    actionId: 'shareServerAccess',
    selection: [srv1],
    currentUser: member,
  })
  assertEq('share: single-server member disabled', r.enabled, false)
  assertEq(
    'share: single-server member tooltip',
    r.reason,
    'You can only share access to servers you own · 0 of 1 eligible',
  )
}

// --- deleteServers (gated by canManageServers) ---

// Admin can delete; member cannot.
{
  const r = bulkActionEligibility({
    actionId: 'deleteServers',
    selection: [srv1, srv2],
    currentUser: admin,
  })
  assertEq('delete: admin enabled', r.enabled, true)
}
{
  const r = bulkActionEligibility({
    actionId: 'deleteServers',
    selection: [srv1],
    currentUser: member,
  })
  assertEq('delete: member disabled', r.enabled, false)
  assertEq(
    'delete: member tooltip',
    r.reason,
    'You can only delete servers you own · 0 of 1 eligible',
  )
}

// --- unknown action ---

{
  const r = bulkActionEligibility({
    actionId: 'nukeEverything',
    selection: [srv1],
    currentUser: owner,
  })
  assertEq('unknown: disabled', r.enabled, false)
  assertEq('unknown: tooltip says unknown', r.reason, 'Unknown action')
}

// --- bulkActionVerb helper ---

assertEq('verb: shareServerAccess', bulkActionVerb('shareServerAccess'), 'share access to')
assertEq('verb: deleteServers', bulkActionVerb('deleteServers'), 'delete')
assertEq('verb: unknown defaults', bulkActionVerb('somethingElse'), 'act on')

// Exit cleanly.
if (failures > 0) {
  console.error(`\n${failures} test(s) FAILED`)
  process.exit(1)
}
console.log('\nAll tests passed.')
