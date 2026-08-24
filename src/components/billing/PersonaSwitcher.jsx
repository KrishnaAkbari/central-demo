'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, UserCircle2 } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { PERSONAS } from '@/services/billingPersonas'
import { seedPersona, getSelectedPersonaId } from '@/services/billingApi'
import { cn } from '@/lib/utils'

// PersonaSwitcher — dropdown in the billing header that re-seeds the
// active Org's billing state to any of the 18 mock personas. Demo /
// internal-only tool for verifying UI states.
//
// Built on Radix DropdownMenu so the menu auto-portals to document.body.
// This guarantees the panel is never clipped by ancestor overflow rules
// (notably shadcn Card's overflow-hidden) and never visually escapes a
// parent card. Radix's collision detection flips up/down based on available
// space at the trigger's position.
//
// Renders nothing on the server (avoids hydration mismatch on the
// initial persona value), shows the current label after mount.
export function PersonaSwitcher({ onChange }) {
  const [currentId, setCurrentId] = useState(null)

  useEffect(() => {
    setCurrentId(getSelectedPersonaId())
  }, [])

  const apply = (id) => {
    seedPersona(id)
    setCurrentId(id)
    if (onChange) onChange(id)
  }

  const current = PERSONAS.find((p) => p.id === currentId) || PERSONAS[0]

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium',
            'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300',
            'border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/60',
            'transition-colors',
          )}
          title="Switch active billing persona (demo only)"
        >
          <UserCircle2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Persona:</span>
          <span className="truncate">
            <span className="hidden lg:inline">{current?.label?.includes(' · ') ? current.label.split(' · ')[0] + ' · ' : ''}</span>
            {current?.label?.split(' · ').pop() || current?.label || 'Select'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-50 w-80 max-h-[min(440px,calc(100vh-4rem))] overflow-y-auto rounded-lg',
            'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl',
            'animate-in fade-in-0 zoom-in-95',
            // Visible scrollbar so users know to scroll if list is tall
            'scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700',
            'scrollbar-track-transparent',
          )}
        >
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">
              Switch billing persona
            </p>
            <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
              Demo tool — replaces the active org's billing state.
            </p>
          </div>
          <ul className="py-1 relative">
            {PERSONAS.map((p) => {
              const active = p.id === currentId
              return (
                <li key={p.id}>
                  <DropdownMenu.Item
                    asChild
                    data-testid={`persona-option-${p.id}`}
                  >
                    <button
                      type="button"
                      onClick={() => apply(p.id)}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors',
                        active && 'bg-indigo-50 dark:bg-indigo-950/30',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900 dark:text-white truncate">
                          {p.label}
                        </span>
                        {active && (
                          <span className="text-xxs text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-1">
                        {p.description}
                      </p>
                    </button>
                  </DropdownMenu.Item>
                </li>
              )
            })}
          </ul>
          {/* Trailing footnote. Shows count + a chevron cue that the list scrolls */}
          <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xxs text-slate-500 dark:text-slate-400 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
            <span>{PERSONAS.length} personas available</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
