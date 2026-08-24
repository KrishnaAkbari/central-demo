'use client'

import { SourcePickerCards } from './SourcePickerCards'

/**
 * SourceStep — pick how you want to add a server.
 *
 * Wizard-mode wrapper around the shared SourcePickerCards. The same cards
 * also appear in the /servers empty state, so a single component owns
 * the source options and their copy.
 */
export function SourceStep({ onPick }) {
  return (
    <div className="space-y-5" data-testid="create-source-main">
      <SourcePickerCards onPick={onPick} />
    </div>
  )
}