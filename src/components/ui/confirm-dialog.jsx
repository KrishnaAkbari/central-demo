"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * ConfirmDialog — shared confirmation modal.
 *
 * Wraps shadcn Dialog primitives. Two modes:
 *   1. Simple: pass `title` + `description`; the body shows the
 *      description, the footer shows Cancel + Confirm.
 *   2. Custom body: pass `children`; the description is suppressed and
 *      children render inside the body slot.
 *
 * Visual design:
 *   - Header: optional destructive icon + title, separated from body.
 *   - Body: padded box with description OR custom children.
 *   - Footer: right-aligned horizontal Cancel + Confirm.
 *   - `variant="destructive"` paints the confirm button red.
 *   - `icon` renders a colored icon next to the title.
 *   - `loading` shows a spinner inside the confirm button and disables both buttons.
 *   - `confirmDisabled` is independent of loading.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Confirm Action",
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "default", // "default" | "destructive"
  icon,
  loading = false,
  confirmDisabled = false,
  children,
  className,
}) {
  const handleCancel = () => {
    if (onCancel) onCancel()
    else onOpenChange?.(false)
  }

  const isDestructive = variant === "destructive"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white max-w-lg p-0 gap-0 overflow-hidden",
          className,
        )}
      >
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2.5 pr-7">
            {icon && (
              <div
                className={
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg " +
                  (isDestructive
                    ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400")
                }
              >
                {icon}
              </div>
            )}
            <DialogTitle className="text-slate-900 dark:text-white text-base font-semibold leading-tight">
              {title}
            </DialogTitle>
          </div>
          {!children && description && (
            <DialogDescription className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-snug">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {children && (
          <div className="px-6 py-5 space-y-4 text-sm text-slate-700 dark:text-slate-200">
            {children}
          </div>
        )}

        <DialogFooter className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4 gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={confirmDisabled || loading}
            loading={loading}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}