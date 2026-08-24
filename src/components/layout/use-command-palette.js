'use client'

import { useEffect, useState, useCallback } from 'react'

/**
 * useCommandPalette — owns the global Cmd+K / Ctrl+K shortcut and the
 * palette open/close state. The palette itself is mounted as a sibling
 * of the trigger so both stay in sync via the returned open/toggle/set.
 *
 * Skips firing when the active element is a text-editable field so the
 * shortcut never fights with form fields.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'k' && e.key !== 'K') return
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod) return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      setOpen((v) => !v)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const toggle = useCallback(() => setOpen((v) => !v), [])

  return { open, setOpen, toggle }
}

function isEditableTarget(target) {
  if (!target || target.nodeType !== 1) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}
