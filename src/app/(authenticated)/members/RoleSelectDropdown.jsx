'use client'

// Custom role picker built on shadcn DropdownMenu primitives.
// Replaces the native <select> that ships with an OS-controlled down
// arrow flush against the right border. Visually: h-9, rounded-md,
// slate border, indigo highlight on the active row, custom ChevronDown
// placed with explicit pr-9 + right-2.5 so it sits ~10px clear of the
// right border on both desktop and mobile.

import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/utils'

export function RoleSelectDropdown({
  value,
  onChange,
  roles = [],
  disabled = false,
  className,
}) {
  const current = roles.find((r) => r.id === value)
  const label = current?.title || current?.name || 'Select role'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          'group relative inline-flex items-center justify-between gap-2',
          'h-9 px-3 pr-9 rounded-md',
          'bg-white dark:bg-slate-800',
          'border border-slate-200 dark:border-slate-700',
          'text-xs font-medium text-slate-700 dark:text-slate-200',
          'shadow-sm transition-colors',
          'hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:hover:bg-slate-700/60',
          'data-[popup-open]:border-indigo-500 data-[popup-open]:ring-2 data-[popup-open]:ring-indigo-500/30',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-slate-800',
          'outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/30',
          'min-w-[8.5rem]',
          className,
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          aria-hidden="true"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 transition-transform group-data-[popup-open]:rotate-180"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[14rem] max-h-72 overflow-y-auto">
        <DropdownMenuLabel>Role</DropdownMenuLabel>
        {roles.length === 0 && (
          <div className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
            No roles defined
          </div>
        )}
        <DropdownMenuRadioGroup value={value || ''} onValueChange={(v) => onChange?.(v)}>
          {roles.map((r) => (
            <DropdownMenuRadioItem key={r.id} value={r.id}>
              <span className="flex items-center gap-2 min-w-0">
                <span className="truncate">{r.title || r.name}</span>
                {!r.isSystem && (
                  <span className="text-xxs font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                    {r.name}
                  </span>
                )}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}